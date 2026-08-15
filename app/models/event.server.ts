import type { Address, Event, Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import { FormSchema, type FieldDescriptor } from "~/features/forms/fields";
import { DEFAULT_FORM } from "~/features/signup-form/default-form";
import {
  CURRENT_FORM_VERSION_ORDER_BY,
  saveFormSchemaInTx,
  type FormVersion,
} from "~/models/form.server";
import {
  IMAGE_METADATA_SELECT,
  releaseImagesIfUnreferenced,
  type ImageCreateData,
  type ImageMetadata,
} from "~/models/image.server";

export type { Address, Event } from "#prisma/generated/client";

// Getters join the cover relation and project the metadata components need
// for URLs and blur-up (null renders the UI fallback artwork).
export type EventWithImage = Event & { image: ImageMetadata | null };

const EVENT_IMAGE_INCLUDE = {
  image: { select: IMAGE_METADATA_SELECT },
} satisfies Prisma.EventInclude;

export interface EventCreateData {
  title: string;
  description: string;
  menuDescription?: string | null;
  donationDescription?: string | null;
  date: Date;
  slots: number;
  price: number;
  discounts?: string | null;
  addressId: string;
  image: ImageCreateData;
  createdById: string;
}

export type EventUpdateData = Partial<EventCreateData>;

// the admin tab bar shows a count pill per section
export async function countEvents(): Promise<number> {
  return prisma.event.count();
}

// the public dinners page shows location ("8004 zürich") on the featured card
export async function getEventsWithAddress(): Promise<
  (EventWithImage & { address: Address })[]
> {
  return prisma.event.findMany({
    orderBy: {
      date: "asc",
    },
    include: {
      address: true,
      ...EVENT_IMAGE_INCLUDE,
    },
  });
}

// the site chrome's "join a dinner" CTA and the landing hero point at the
// next upcoming dinner. `date: { gte: new Date() }` is the DB-side twin of
// app/features/events/event-status.ts#isPastEvent: `date >= now` is upcoming,
// an event on `now` exactly included. Models cannot import features, so this
// comment is the link — keep the two rules in sync.
function nextEventArgs(now: Date) {
  return {
    where: { date: { gte: now } },
    orderBy: { date: "asc" },
  } satisfies Prisma.EventFindFirstArgs;
}

export async function getNextEvent(
  now = new Date(),
): Promise<(EventWithImage & { address: Address }) | null> {
  return prisma.event.findFirst({
    ...nextEventArgs(now),
    include: { address: true, ...EVENT_IMAGE_INCLUDE },
  });
}

export async function getEventById(
  id: string,
): Promise<(EventWithImage & { address: Address }) | null> {
  return prisma.event.findUnique({
    where: { id },
    include: {
      address: true,
      ...EVENT_IMAGE_INCLUDE,
    },
  });
}

/**
 * Read the event detail and the latest version of its owned signup form as a
 * single model operation. Returning null for either missing row preserves the
 * routes' one consistent not-found outcome; every valid event has at least one
 * version by construction.
 */
export async function getEventWithCurrentFormVersion(id: string): Promise<{
  event: EventWithImage & { address: Address };
  version: FormVersion;
} | null> {
  const record = await prisma.event.findUnique({
    where: { id },
    include: {
      address: true,
      ...EVENT_IMAGE_INCLUDE,
      form: {
        select: {
          versions: { orderBy: CURRENT_FORM_VERSION_ORDER_BY, take: 1 },
        },
      },
    },
  });

  if (!record) return null;

  const [version] = record.form.versions;
  if (!version) return null;

  const { form: _form, ...event } = record;
  return { event, version };
}

// Every event owns a form (Event.formId is non-nullable) and a cover image,
// so the image, the form and its first version are created in the same
// transaction — a failed event write must not leave an orphan image row. The
// fields re-parse through FormSchema so only valid, normalized descriptors
// are ever stored; profile validation (SignupFormSchema) stays with the
// callers.
export async function createEvent(
  data: EventCreateData,
  formFields: FieldDescriptor[] = DEFAULT_FORM,
): Promise<Event> {
  const schema = FormSchema.parse(formFields);
  const { image, ...eventData } = data;

  return prisma.$transaction(async (tx) => {
    const form = await tx.form.create({
      data: {
        versions: {
          create: {
            version: 1,
            schema: schema as Prisma.InputJsonValue,
          },
        },
      },
    });

    const cover = await tx.image.create({ data: image });

    return tx.event.create({
      data: { ...eventData, formId: form.id, imageId: cover.id },
    });
  });
}

export async function updateEvent(
  id: string,
  data: EventUpdateData,
  formFields?: FieldDescriptor[],
): Promise<{ event: Event; replacedImageKey: string | null }> {
  const { image, ...eventData } = data;

  if (!image && !formFields) {
    const event = await prisma.event.update({ where: { id }, data: eventData });
    return { event, replacedImageKey: null };
  }

  return prisma.$transaction(async (tx) => {
    let previousImageId: string | null = null;

    if (image) {
      const current = await tx.event.findUnique({
        where: { id },
        select: { imageId: true },
      });
      previousImageId = current?.imageId ?? null;
    }

    const cover = image ? await tx.image.create({ data: image }) : null;

    const event = await tx.event.update({
      where: { id },
      data: { ...eventData, ...(cover && { imageId: cover.id }) },
    });

    if (formFields) {
      await saveFormSchemaInTx(tx, event.formId, formFields);
    }

    // released only after the slot moved on, so the old cover survives when
    // a gallery still shows it
    let replacedImageKey: string | null = null;
    if (previousImageId) {
      const { storageKeys } = await releaseImagesIfUnreferenced(tx, [
        previousImageId,
      ]);
      replacedImageKey = storageKeys[0] ?? null;
    }

    return { event, replacedImageKey };
  });
}

/**
 * Deletes the matched events with their forms, then releases every image the
 * events referenced — cover slots and gallery links alike. An image another
 * dinner or a slot still references survives; the storageKeys of those that
 * fell come back for the caller's post-commit provider destroy.
 */
export async function deleteEventsInTx(
  tx: Prisma.TransactionClient,
  where: Prisma.EventWhereInput,
): Promise<string[]> {
  const events = await tx.event.findMany({
    where,
    select: {
      id: true,
      formId: true,
      imageId: true,
      galleryImages: { select: { imageId: true } },
    },
  });
  if (events.length === 0) return [];

  const eventIds = events.map((event) => event.id);
  const formIds = events.map((event) => event.formId);
  const imageIds = events.flatMap((event) => [
    ...(event.imageId ? [event.imageId] : []),
    ...event.galleryImages.map((link) => link.imageId),
  ]);

  await tx.formSubmission.deleteMany({
    where: { formVersion: { formId: { in: formIds } } },
  });
  await tx.formVersion.deleteMany({ where: { formId: { in: formIds } } });
  await tx.event.deleteMany({ where: { id: { in: eventIds } } });
  await tx.form.deleteMany({ where: { id: { in: formIds } } });
  const { storageKeys } = await releaseImagesIfUnreferenced(tx, imageIds);

  return storageKeys;
}

// The caller destroys the returned imageKeys' provider assets AFTER this
// transaction committed (a leaked asset on crash is acceptable, a dangling
// DB reference is not).
export async function deleteEvent(
  id: string,
): Promise<{ event: Event; imageKeys: string[] }> {
  return prisma.$transaction(async (tx) => {
    // findUniqueOrThrow keeps prisma.event.delete's throw-on-missing behavior
    const event = await tx.event.findUniqueOrThrow({ where: { id } });
    const imageKeys = await deleteEventsInTx(tx, { id });

    return { event, imageKeys };
  });
}
