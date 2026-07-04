import type { Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";

// Thrown when the pinned version changed between the caller's validation and
// the insert — the answers were validated against a schema that no longer
// exists, so storing them would corrupt the version's history.
export class FormVersionChangedError extends Error {
  constructor() {
    super("The form version changed while the submission was being written");
    this.name = "FormVersionChangedError";
  }
}

export async function createFormSubmission({
  formVersionId,
  answers,
  expectedVersionUpdatedAt,
}: {
  formVersionId: string;
  answers: Prisma.InputJsonValue;
  // pass the updatedAt of the version the answers were validated against to
  // reject the write if an in-place schema update raced it
  expectedVersionUpdatedAt?: Date;
}) {
  if (expectedVersionUpdatedAt === undefined) {
    return prisma.formSubmission.create({
      data: { formVersionId, answers },
    });
  }

  return prisma.$transaction(async (tx) => {
    const version = await tx.formVersion.findUniqueOrThrow({
      where: { id: formVersionId },
      select: { updatedAt: true },
    });

    if (version.updatedAt.getTime() !== expectedVersionUpdatedAt.getTime()) {
      throw new FormVersionChangedError();
    }

    return tx.formSubmission.create({
      data: { formVersionId, answers },
    });
  });
}

// Submissions carry no eventId; the link is Event.formId -> FormVersion.formId.
// Each submission comes with the version it answered so stored answers are
// interpreted against the exact schema they were written for.
export async function getFormSubmissionsForEvent(eventId: string) {
  return prisma.formSubmission.findMany({
    where: { formVersion: { form: { event: { id: eventId } } } },
    include: { formVersion: true },
    orderBy: { createdAt: "asc" },
  });
}
