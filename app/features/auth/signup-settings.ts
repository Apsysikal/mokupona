// Client-safe vocabulary for the self-signup toggles. The state itself lives
// in `signup-settings.server.ts`; only the names and copy are shared with the
// browser bundle (same split as `roles.ts`).

export const SIGNUP_METHODS = ["email", "google"] as const;
export type SignupMethod = (typeof SIGNUP_METHODS)[number];

/** Which self-signup methods are currently open. */
export type SignupSettings = Record<SignupMethod, boolean>;

export const SIGNUP_METHOD_LABELS = {
  email: "email and password",
  google: "google",
} as const satisfies Record<SignupMethod, string>;

export const SIGNUP_METHOD_DESCRIPTIONS = {
  email: "lets anyone create an account from the sign-up form.",
  google:
    "lets a first-time google sign-in create an account. existing accounts can always sign in with google.",
} as const satisfies Record<SignupMethod, string>;

/**
 * The error code better-auth redirects with when the OAuth callback refuses to
 * register a new user (`link-account.mjs` turns "signup disabled" into this).
 */
export const OAUTH_SIGNUP_DISABLED_ERROR = "signup_disabled";

/** Shown wherever a closed sign-up path has to explain itself. */
export const SIGNUP_CLOSED_MESSAGE =
  "sign-ups are closed right now. if you were invited, use the link in your invitation email.";

/** The same message where Google is still an option on the very same page. */
export const EMAIL_SIGNUP_CLOSED_MESSAGE =
  "email sign-ups are closed right now. you can still continue with google below.";

/** Google's variant, where the email form may well still be open. */
export const GOOGLE_SIGNUP_CLOSED_MESSAGE =
  "we aren't creating new accounts from google sign-in right now. if you were invited, use the link in your invitation email.";

export function isSignupMethod(value: string): value is SignupMethod {
  return SIGNUP_METHODS.some((method) => method === value);
}
