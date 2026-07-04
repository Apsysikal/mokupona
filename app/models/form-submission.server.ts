import type { Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";

export async function createFormSubmission({
  formVersionId,
  answers,
}: {
  formVersionId: string;
  answers: Prisma.InputJsonValue;
}) {
  return prisma.formSubmission.create({
    data: { formVersionId, answers },
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
