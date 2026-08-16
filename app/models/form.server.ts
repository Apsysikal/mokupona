import { isDeepStrictEqual } from "node:util";

import type { Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import { FormSchema, type FieldDescriptor } from "~/features/forms/fields";
import { parseStoredFormSchema } from "~/features/forms/serialization";

export type { FormVersion } from "#prisma/generated/client";

export const CURRENT_FORM_VERSION_ORDER_BY = { version: "desc" } as const;

const currentVersionArgs = (where: Prisma.FormVersionWhereInput) =>
  ({
    where,
    orderBy: CURRENT_FORM_VERSION_ORDER_BY,
  }) satisfies Prisma.FormVersionFindFirstArgs;

export async function getCurrentFormVersion(formId: string) {
  return prisma.formVersion.findFirstOrThrow(currentVersionArgs({ formId }));
}

export async function getCurrentFormVersionForEvent(eventId: string) {
  return prisma.formVersion.findFirst(
    currentVersionArgs({ form: { event: { id: eventId } } }),
  );
}

export async function saveFormSchema(
  formId: string,
  fields: FieldDescriptor[],
) {
  return prisma.$transaction(async (tx) =>
    saveFormSchemaInTx(tx, formId, fields),
  );
}

export async function saveFormSchemaInTx(
  tx: Prisma.TransactionClient,
  formId: string,
  fields: FieldDescriptor[],
) {
  const next = FormSchema.parse(fields);

  const current = await tx.formVersion.findFirstOrThrow({
    ...currentVersionArgs({ formId }),
    include: { _count: { select: { submissions: true } } },
  });

  const stored = parseStoredFormSchema(current.schema);
  if (stored.success && isDeepStrictEqual(stored.data, next)) {
    return current;
  }

  if (current._count.submissions === 0) {
    const updated = await tx.formVersion.updateMany({
      where: { id: current.id, submissions: { none: {} } },
      data: { schema: next as Prisma.InputJsonValue },
    });
    if (updated.count === 1) {
      return tx.formVersion.findUniqueOrThrow({ where: { id: current.id } });
    }
  }

  return tx.formVersion.create({
    data: {
      formId,
      version: current.version + 1,
      schema: next as Prisma.InputJsonValue,
    },
  });
}
