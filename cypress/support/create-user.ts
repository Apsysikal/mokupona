// Use this to create a new user and login with that user
// Simply call this with:
// npx tsx ./cypress/support/create-user.ts username@example.com,
// and it will log out the cookie value you can use to interact with the server
// as that new user.

export {}; // top-level await needs module scope

// mail side effects stay out of the shared capture directory — a user
// factory must never clear or pollute what a running test is reading
process.env.MAIL_PROVIDER = "console";

const SESSION_COOKIE = "better-auth.session_token";

async function createAndLogin(email: string) {
  if (!email) {
    throw new Error("email required for login");
  }
  if (!email.endsWith("@example.com")) {
    throw new Error("All test emails must end in @example.com");
  }

  const { auth } = await import("~/features/auth/auth.server");
  const { createUserViaAuth } =
    await import("~/features/auth/create-user.server");

  await createUserViaAuth({
    email,
    password: "myreallystrongpassword",
    name: "test user",
    emailVerified: true,
  });

  const { headers } = await auth.api.signInEmail({
    body: { email, password: "myreallystrongpassword" },
    returnHeaders: true,
  });

  const setCookie = headers.get("set-cookie") ?? "";
  const match = setCookie.match(
    new RegExp(`${SESSION_COOKIE.replace(".", "\\.")}=([^;]+)`),
  );
  if (!match) {
    throw new Error("Session cookie missing from sign-in response");
  }

  // raw (still URL-encoded) value — cypress sets it verbatim
  console.log(
    `
<cookie>
  ${match[1]}
</cookie>
  `.trim(),
  );
}

createAndLogin(process.argv[2]);
