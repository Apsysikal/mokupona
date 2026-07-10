export {}; // keeps the script in module scope (shared const names otherwise clash)

// mail side effects stay out of the shared capture directory
process.env.MAIL_PROVIDER = "console";

const SESSION_COOKIE = "better-auth.session_token";

const seededRoleEmails = {
  moderator: "moderator@mokupona.ch",
  admin: "admin@mokupona.ch",
} as const;

async function createRoleSession(roleArg: string | undefined) {
  const role = roleArg === "admin" ? "admin" : "moderator";

  const { auth } = await import("~/features/auth/auth.server");

  let headers: Headers;
  try {
    ({ headers } = await auth.api.signInEmail({
      body: { email: seededRoleEmails[role], password: "mokupona" },
      returnHeaders: true,
    }));
  } catch {
    throw new Error(
      `Seeded ${role} user could not sign in. Run the seed script before Cypress tests.`,
    );
  }

  const setCookie = headers.get("set-cookie") ?? "";
  const match = setCookie.match(
    new RegExp(`${SESSION_COOKIE.replace(".", "\\.")}=([^;]+)`),
  );

  if (!match) {
    throw new Error("Session cookie missing from sign-in response");
  }

  console.log(
    `
<cookie>
  ${match[1]}
</cookie>
  `.trim(),
  );
}

createRoleSession(process.argv[2]);
