import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import invariant from "tiny-invariant";

import { prisma } from "~/db.server";
import { sendTemplate } from "~/features/mail/mail.server";
import { logger } from "~/logger.server";
import { getRoleByName } from "~/models/role.server";
import { setUserEmailVerified } from "~/models/user.server";
import { singleton } from "~/utils/singleton.server";

invariant(process.env.BETTER_AUTH_SECRET, "BETTER_AUTH_SECRET must be set");

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleProvider =
  googleClientId && googleClientSecret
    ? { clientId: googleClientId, clientSecret: googleClientSecret }
    : undefined;

export const googleAuthEnabled = Boolean(googleProvider);

export const auth = singleton("better-auth", () =>
  betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: prismaAdapter(prisma, { provider: "sqlite" }),
    user: {
      additionalFields: {
        // never part of any API input/output contract — the create hook
        // below fills it; declared so the adapter persists it
        roleId: { type: "string", required: false, input: false },
      },
    },
    socialProviders: googleProvider ? { google: googleProvider } : undefined,
    account: {
      accountLinking: {
        enabled: true,
        // safe to auto-link by email: password accounts are always verified
        // (design §2 — closes the pre-registration takeover attack)
        trustedProviders: ["google"],
      },
    },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      sendResetPassword: ({ user, url }) =>
        sendTemplate("resetPassword", user.email, { url }),
      // completing a reset proves mailbox ownership — this is how force-reset
      // migrated users get verified (design §7); deliberate, don't "fix" it
      onPasswordReset: ({ user }) => setUserEmailVerified(user.id),
    },
    emailVerification: {
      // explicit false — unset falls back to requireEmailVerification (true).
      // join.tsx sends the initial mail itself; invite signup must send
      // nothing, the invite link already proved mailbox control (design §6)
      sendOnSignUp: false,
      // an unverified login attempt re-sends the link — this IS the resend
      // path; the UI deliberately has no resend button (design §5)
      sendOnSignIn: true,
      autoSignInAfterVerification: false,
      sendVerificationEmail: ({ user, url }) =>
        sendTemplate("verifyEmail", user.email, { url }),
    },
    databaseHooks: {
      user: {
        create: {
          // every signup path (password, Google, invite) must produce a
          // roleId — the non-null FK is the safety net if one is missed
          before: async (user) => {
            const role = await getRoleByName("user");
            if (!role) {
              logger.error("Default role 'user' missing during signup");
              throw new Error("Default role 'user' is not seeded");
            }
            return { data: { ...user, roleId: role.id } };
          },
        },
      },
    },
  }),
);
