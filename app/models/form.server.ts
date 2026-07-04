import { isDeepStrictEqual } from "node:util";

import type { Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import { FormSchema, type FieldDescriptor } from "~/features/forms/fields";
import { parseStoredFormSchema } from "~/features/forms/serialization";

// The single definition of "current version": max(version) for the form.
const currentVersionArgs = (formId: string) =>
  ({
    where: { formId },
    orderBy: { version: "desc" },
  }) satisfies Prisma.FormVersionFindFirstArgs;

// Every form has at least one version by construction (created with the
// event, backfilled by migration).
export async function getCurrentFormVersion(formId: string) {
  return prisma.formVersion.findFirstOrThrow(currentVersionArgs(formId));
}

// Versioning policy (design §9), applied on every save of a form's schema:
//   1. deep-equal to the current version's schema -> do nothing;
//   2. current version has no submissions -> update it in place;
//   3. otherwise -> create a new version with version = current + 1.
// Versions with submissions are therefore immutable.
//
// The input re-parses through FormSchema so what is compared and stored is
// the normalized shape (labels trimmed, defaults applied) — otherwise a
// semantically identical save would mint a spurious new version. Profile
// validation (SignupFormSchema) stays with the callers; invalid generic
// descriptors throw, which is a caller bug.
export async function saveFormSchema(
  formId: string,
  fields: FieldDescriptor[],
) {
  const next = FormSchema.parse(fields);

  return prisma.$transaction(async (tx) => {
    const current = await tx.formVersion.findFirstOrThrow({
      ...currentVersionArgs(formId),
      include: { _count: { select: { submissions: true } } },
    });

    const stored = parseStoredFormSchema(current.schema);
    if (stored.success && isDeepStrictEqual(stored.data, next)) {
      return current;
    }

    if (current._count.submissions === 0) {
      return tx.formVersion.update({
        where: { id: current.id },
        data: { schema: next as Prisma.InputJsonValue },
      });
    }

    return tx.formVersion.create({
      data: {
        formId,
        version: current.version + 1,
        schema: next as Prisma.InputJsonValue,
      },
    });
  });
}
