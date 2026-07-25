import { prisma } from "~/db.server";

// better-auth stores pending reset tokens as Verification rows keyed
// `reset-password:<token>` with the user id as the value. Resolving one lets
// the reset form dead-end stale links on load and address the user by email.
export async function getPasswordResetEmail(
  token: string,
): Promise<string | null> {
  const verification = await prisma.verification.findFirst({
    where: { identifier: `reset-password:${token}` },
  });
  if (!verification || verification.expiresAt < new Date()) return null;

  const user = await prisma.user.findUnique({
    where: { id: verification.value },
    select: { email: true },
  });
  return user?.email ?? null;
}
