export {};

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
