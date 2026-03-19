import { parse } from "cookie";

import { getUserByEmail } from "~/models/user.server";
import { createUserSession } from "~/utils/session.server";

const seededRoleEmails = {
  moderator: "moderator@mokupona.ch",
  admin: "admin@mokupona.ch",
} as const;

async function createRoleSession(roleArg: string | undefined) {
  const role = roleArg === "admin" ? "admin" : "moderator";
  const user = await getUserByEmail(seededRoleEmails[role]);

  if (!user) {
    throw new Error(
      `Seeded ${role} user not found. Run the seed script before Cypress tests.`,
    );
  }

  const response = await createUserSession({
    request: new Request("test://test"),
    userId: user.id,
    remember: false,
    redirectTo: "/",
  });

  const cookieValue = response.headers.get("Set-Cookie");

  if (!cookieValue) {
    throw new Error("Cookie missing from createUserSession response");
  }

  const parsedCookie = parse(cookieValue);

  console.log(
    `
<cookie>
  ${parsedCookie.__session}
</cookie>
  `.trim(),
  );
}

createRoleSession(process.argv[2]);
