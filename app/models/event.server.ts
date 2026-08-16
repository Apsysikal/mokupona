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
  type ImageCreateData,
  type ImageMetadata,
} from "~/models/image.server";

export type { Address, Event } from "#prisma/generated/client";

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

export async function countEvents(): Promise<number> {
  return prisma.event.count();
}

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

    return tx.event.create({
      data: { ...eventData, formId: form.id, image: { create: image } },
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
    let replacedImageKey: string | null = null;

    if (image) {
      const replaced = await tx.image.findUnique({
        where: { eventId: id },
        select: { storageKey: true },
      });
      replacedImageKey = replaced?.storageKey ?? null;
      await tx.image.deleteMany({ where: { eventId: id } });
    }

    const event = await tx.event.update({
      where: { id },
      data: { ...eventData, ...(image && { image: { create: image } }) },
    });

    if (formFields) {
      await saveFormSchemaInTx(tx, event.formId, formFields);
    }

    return { event, replacedImageKey };
  });
}

export async function deleteEventsInTx(
  tx: Prisma.TransactionClient,
  where: Prisma.EventWhereInput,
): Promise<{ id: string; formId: string; imageKey: string | null }[]> {
  const events = await tx.event.findMany({
    where,
    select: {
      id: true,
      formId: true,
      image: { select: { storageKey: true } },
    },
  });
  if (events.length === 0) return [];

  const eventIds = events.map((event) => event.id);
  const formIds = events.map((event) => event.formId);

  await tx.formSubmission.deleteMany({
    where: { formVersion: { formId: { in: formIds } } },
  });
  await tx.formVersion.deleteMany({ where: { formId: { in: formIds } } });
  await tx.event.deleteMany({ where: { id: { in: eventIds } } });
  await tx.form.deleteMany({ where: { id: { in: formIds } } });

  return events.map(({ image, ...event }) => ({
    ...event,
    imageKey: image?.storageKey ?? null,
  }));
}

export async function deleteEvent(
  id: string,
): Promise<{ event: Event; imageKey: string | null }> {
  return prisma.$transaction(async (tx) => {
    const event = await tx.event.findUniqueOrThrow({ where: { id } });
    const [deleted] = await deleteEventsInTx(tx, { id });

    return { event, imageKey: deleted?.imageKey ?? null };
  });
}
