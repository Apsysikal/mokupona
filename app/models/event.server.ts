import type { Address, Event, Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import { FormSchema, type FieldDescriptor } from "~/features/forms/fields";
import { DEFAULT_FORM } from "~/features/signup-form/default-form";
import {
  CURRENT_FORM_VERSION_ORDER_BY,
  saveFormSchemaInTx,
} from "~/models/form.server";
import {
  createImageInTx,
  deleteImageInTx,
  type ImageData,
} from "~/models/image.server";

export type { Address, Event } from "#prisma/generated/client";

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
  image: ImageData;
  createdById: string;
}

export type EventUpdateData = Partial<EventCreateData>;

// the admin tab bar shows a count pill per section
export async function countEvents(): Promise<number> {
  return prisma.event.count();
}

// the public dinners page shows location ("8004 zürich") on the featured card
export async function getEventsWithAddress(): Promise<
  (Event & { address: Address })[]
> {
  return prisma.event.findMany({
    orderBy: {
      date: "asc",
    },
    include: {
      address: true,
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
): Promise<(Event & { address: Address }) | null> {
  return prisma.event.findFirst({
    ...nextEventArgs(now),
    include: { address: true },
  });
}

export async function getEventById(
  id: string,
): Promise<(Event & { address: Address }) | null> {
  return prisma.event.findUnique({
    where: { id },
    include: {
      address: true,
    },
  });
}

/**
 * Read the event detail and the latest version of its owned signup form as a
 * single model operation. Returning null for either missing row preserves the
 * routes' one consistent not-found outcome; every valid event has at least one
 * version by construction.
 */
export async function getEventWithCurrentFormVersion(id: string) {
  const record = await prisma.event.findUnique({
    where: { id },
    include: {
      address: true,
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
    const { id: imageId } = await createImageInTx(tx, image);

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

    return tx.event.create({
      data: { ...eventData, imageId, formId: form.id },
    });
  });
}

// When formFields or a new cover image are provided, everything persists in
// ONE transaction (the create path is atomic too) — a failure must not leave
// the event updated but its form unchanged, nor leak an image row. A cover
// swap runs strictly as create new image -> repoint event -> delete old
// image: the DB cascade Image -> Event means deleting an image the event
// still points at would delete the event itself.
export async function updateEvent(
  id: string,
  data: EventUpdateData,
  formFields?: FieldDescriptor[],
): Promise<Event> {
  const { image, ...eventData } = data;

  if (!image && !formFields) {
    return prisma.event.update({ where: { id }, data: eventData });
  }

  return prisma.$transaction(async (tx) => {
    let oldImageId: string | undefined;
    let newImageId: string | undefined;

    if (image) {
      const current = await tx.event.findUniqueOrThrow({
        where: { id },
        select: { imageId: true },
      });
      oldImageId = current.imageId;
      newImageId = (await createImageInTx(tx, image)).id;
    }

    const event = await tx.event.update({
      where: { id },
      data: { ...eventData, ...(newImageId && { imageId: newImageId }) },
    });

    if (formFields) {
      await saveFormSchemaInTx(tx, event.formId, formFields);
    }

    // last, once the event no longer points at it (see cascade note above)
    if (oldImageId) {
      await deleteImageInTx(tx, oldImageId);
    }

    return event;
  });
}

// The FK points Event -> Form (Restrict), so deleting an event does not
// cascade to its form data, and Image -> Event points the wrong way for the
// cover to go with the event. All event deletes must go through here (design
// §3.2): submissions and versions first, then the events, then the forms —
// the Restrict FKs force the event rows to go before their forms — and last
// the now-unreferenced cover images. Callers that delete rows Event itself
// cascades from at the DB level (User, Address, Image) must run this first,
// in the same transaction, or the DB cascade skips it and orphans the form
// and image rows.
export async function deleteEventsInTx(
  tx: Prisma.TransactionClient,
  where: Prisma.EventWhereInput,
) {
  const events = await tx.event.findMany({
    where,
    select: { id: true, formId: true, imageId: true },
  });
  if (events.length === 0) return [];

  const eventIds = events.map((event) => event.id);
  const formIds = events.map((event) => event.formId);
  const imageIds = events.map((event) => event.imageId);

  await tx.formSubmission.deleteMany({
    where: { formVersion: { formId: { in: formIds } } },
  });
  await tx.formVersion.deleteMany({ where: { formId: { in: formIds } } });
  await tx.event.deleteMany({ where: { id: { in: eventIds } } });
  await tx.form.deleteMany({ where: { id: { in: formIds } } });
  await tx.image.deleteMany({ where: { id: { in: imageIds } } });

  return events;
}

export async function deleteEvent(id: string): Promise<Event> {
  return prisma.$transaction(async (tx) => {
    // findUniqueOrThrow keeps prisma.event.delete's throw-on-missing behavior
    const event = await tx.event.findUniqueOrThrow({ where: { id } });
    await deleteEventsInTx(tx, { id });

    return event;
  });
}
