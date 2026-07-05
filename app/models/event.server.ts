import type { Address, Event, Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import { FormSchema, type FieldDescriptor } from "~/features/forms/fields";
import { DEFAULT_FORM } from "~/features/signup-form/default-form";
import { saveFormSchemaInTx } from "~/models/form.server";

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
  imageId: string;
  createdById: string;
}

export type EventUpdateData = Partial<EventCreateData>;

export async function getEvents(): Promise<Event[]> {
  return prisma.event.findMany({
    orderBy: {
      date: "asc",
    },
  });
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
// next upcoming dinner
export async function getNextEvent(): Promise<Event | null> {
  return prisma.event.findFirst({
    where: { date: { gte: new Date() } },
    orderBy: { date: "asc" },
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

// Every event owns a form (Event.formId is non-nullable), so the form and its
// first version are created in the same transaction. The fields re-parse
// through FormSchema so only valid, normalized descriptors are ever stored;
// profile validation (SignupFormSchema) stays with the callers.
export async function createEvent(
  data: EventCreateData,
  formFields: FieldDescriptor[] = DEFAULT_FORM,
): Promise<Event> {
  const schema = FormSchema.parse(formFields);

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
      data: { ...data, formId: form.id },
    });
  });
}

// When formFields are provided, event data and form schema persist in ONE
// transaction (the create path is atomic too) — a failure must not leave the
// event updated but its form unchanged.
export async function updateEvent(
  id: string,
  data: EventUpdateData,
  formFields?: FieldDescriptor[],
): Promise<Event> {
  if (!formFields) {
    return prisma.event.update({ where: { id }, data });
  }

  return prisma.$transaction(async (tx) => {
    const event = await tx.event.update({ where: { id }, data });
    await saveFormSchemaInTx(tx, event.formId, formFields);
    return event;
  });
}

// The FK points Event -> Form (Restrict), so deleting an event does not
// cascade to its form data. All event deletes must go through here (design
// §3.2): submissions and versions first, then the events, then the forms —
// the Restrict FKs force the event rows to go before their forms. Callers
// that delete rows Event itself cascades from at the DB level (User, Address,
// Image) must run this first, in the same transaction, or the DB cascade
// skips it and orphans the form rows.
export async function deleteEventsInTx(
  tx: Prisma.TransactionClient,
  where: Prisma.EventWhereInput,
) {
  const events = await tx.event.findMany({
    where,
    select: { id: true, formId: true },
  });
  if (events.length === 0) return [];

  const formIds = events.map((event) => event.formId);

  await tx.formSubmission.deleteMany({
    where: { formVersion: { formId: { in: formIds } } },
  });
  await tx.formVersion.deleteMany({ where: { formId: { in: formIds } } });
  await tx.event.deleteMany({
    where: { id: { in: events.map((event) => event.id) } },
  });
  await tx.form.deleteMany({ where: { id: { in: formIds } } });

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
