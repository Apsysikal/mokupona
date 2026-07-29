import type { Route } from "./+types/api.auth.$";

import { auth } from "~/features/auth/auth.server";
import { isSignupEnabled } from "~/features/auth/signup-settings.server";
import { logger } from "~/logger.server";
import { getClientIPAddress } from "~/shared/http.server";

// better-auth's registration endpoint. Neither /join nor the invite flow
// reaches it through this route — both call `auth.api.signUpEmail` directly —
// so guarding here closes the direct-POST path without touching either. A
// hand-rolled request has to be refused the same way the form is.
const SIGN_UP_EMAIL_PATH = "/sign-up/email";

export const loader = async ({ request }: Route.LoaderArgs) =>
  auth.handler(request);

export const action = async ({ request }: Route.ActionArgs) => {
  const { pathname } = new URL(request.url);

  if (pathname.endsWith(SIGN_UP_EMAIL_PATH) && !isSignupEnabled("email")) {
    logger.warn("Blocked email signup while self-signup is disabled", {
      ip: getClientIPAddress(request),
    });
    return Response.json(
      { code: "SIGNUP_DISABLED", message: "Sign-ups are currently disabled" },
      { status: 403 },
    );
  }

  return auth.handler(request);
};
