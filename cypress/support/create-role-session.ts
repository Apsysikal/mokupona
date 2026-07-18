export {}; // keeps the script in module scope (shared const names otherwise clash)

// mail side effects stay out of the shared capture directory
process.env.MAIL_PROVIDER = "console";

const seededRoleEmails = {
  moderator: "moderator@mokupona.ch",
  admin: "admin@mokupona.ch",
} as const;

async function createRoleSession(roleArg: string | undefined) {
  const role = roleArg === "admin" ? "admin" : "moderator";

  const { printSessionCookie } = await import("./session-cookie");

  try {
    await printSessionCookie(seededRoleEmails[role], "mokupona");
  } catch {
    throw new Error(
      `Seeded ${role} user could not sign in. Run the seed script before Cypress tests.`,
    );
  }
}

createRoleSession(process.argv[2]);
