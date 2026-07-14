// Use this to create a new user and login with that user
// Simply call this with:
// npx tsx ./cypress/support/create-user.ts username@example.com,
// and it will log out the cookie value you can use to interact with the server
// as that new user.

export {}; // top-level await needs module scope

// mail side effects stay out of the shared capture directory — a user
// factory must never clear or pollute what a running test is reading
process.env.MAIL_PROVIDER = "console";

const PASSWORD = "myreallystrongpassword";

async function createAndLogin(email: string) {
  if (!email) {
    throw new Error("email required for login");
  }
  if (!email.endsWith("@example.com")) {
    throw new Error("All test emails must end in @example.com");
  }

  const { createUserViaAuth } =
    await import("~/features/auth/create-user.server");
  const { printSessionCookie } = await import("./session-cookie");

  await createUserViaAuth({
    email,
    password: PASSWORD,
    name: "test user",
    emailVerified: true,
  });
  await printSessionCookie(email, PASSWORD);
}

createAndLogin(process.argv[2]);
