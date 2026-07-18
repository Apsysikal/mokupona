// Creates an invite (as the seeded admin) and prints its token — lets tests
// exercise the acceptance route without driving the admin UI each time.
// Usage: npx tsx ./cypress/support/create-invite.ts <email> <role> [expired]

export {};

process.env.MAIL_PROVIDER = "console";

async function createInvite(email: string, roleName: string, expired?: string) {
  if (!email.endsWith("@example.com")) {
    throw new Error("All test emails must end in @example.com");
  }
  if (roleName !== "user" && roleName !== "moderator") {
    throw new Error(`Invalid invite role "${roleName}"`);
  }

  const { prisma } = await import("~/db.server");
  const { upsertInvite } = await import("~/models/invite.server");
  const { getUserByEmail } = await import("~/models/user.server");

  const admin = await getUserByEmail("admin@mokupona.ch");
  if (!admin) {
    throw new Error("Seeded admin not found. Run the seed script first.");
  }

  // upsertInvite is the one place the raw token surfaces (the DB only holds
  // its hash), so keep it from here even when we backdate the expiry below
  const invite = await upsertInvite({
    email,
    roleName,
    createdById: admin.id,
  });

  if (expired === "expired") {
    await prisma.invite.update({
      where: { id: invite.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
  }

  console.log(`<token>${invite.token}</token>`);
}

createInvite(process.argv[2], process.argv[3], process.argv[4]);
