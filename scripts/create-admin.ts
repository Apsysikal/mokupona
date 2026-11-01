import "dotenv/config";

import { randomBytes } from "node:crypto";

import { createUserViaAuth } from "~/features/auth/create-user.server";
import { ROLE_NAMES } from "~/features/auth/roles";
import { ensureRoles } from "~/models/role.server";
import { getUserByEmail } from "~/models/user.server";

/**
 * Bootstrap the first admin on an empty database — a freshly created staging
 * environment, say, where nobody exists yet to send an invite. Creates the
 * roles if they are missing, then an admin account with a random password
 * that is printed once. Run it inside the deployed container:
 *
 *   npx tsx scripts/create-admin.ts you@example.com "Your Name"
 */
async function main() {
  const [email, name = "Admin"] = process.argv.slice(2);
  if (!email?.includes("@")) {
    console.error(
      'usage: npx tsx scripts/create-admin.ts you@example.com "Your Name"',
    );
    process.exitCode = 1;
    return;
  }

  await ensureRoles(ROLE_NAMES);

  if (await getUserByEmail(email)) {
    console.error(`${email} already has an account; nothing changed.`);
    process.exitCode = 1;
    return;
  }

  const password = randomBytes(18).toString("base64url");
  await createUserViaAuth({
    email,
    password,
    name,
    roleName: "admin",
    emailVerified: true,
  });

  console.log(`Created admin ${email}`);
  console.log(`Password (shown once — change it on /me): ${password}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
