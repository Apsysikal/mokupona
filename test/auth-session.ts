import { faker } from "@faker-js/faker";

import { auth } from "~/features/auth/auth.server";
import { createUserViaAuth } from "~/features/auth/create-user.server";
import type { RoleName } from "~/features/auth/roles";

// Node-environment tests only: better-auth needs the real fetch primitives,
// which happy-dom replaces.

/**
 * Creates a verified user, signs it in through better-auth, and returns the
 * user plus a Request for `path` carrying the session cookie.
 */
export async function signedInRequest({
  roleName = "user",
  path,
}: {
  roleName?: RoleName;
  path: string;
}) {
  const email = `signed-in-${faker.string.uuid()}@example.com`;
  const password = faker.internet.password({ length: 16 });
  const user = await createUserViaAuth({
    email,
    password,
    name: "signed-in test",
    roleName,
    emailVerified: true,
  });

  const { headers } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = (headers.get("set-cookie") ?? "").split(";")[0];

  return {
    user,
    request: new Request(`http://localhost:3000${path}`, {
      headers: { cookie },
    }),
  };
}
