import { prisma } from "~/db.server";

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
