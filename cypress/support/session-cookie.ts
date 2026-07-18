const SESSION_COOKIE = "better-auth.session_token";

export async function printSessionCookie(email: string, password: string) {
  const { auth } = await import("~/features/auth/auth.server");
  const { headers } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = (headers.get("set-cookie") ?? "").match(
    new RegExp(`${SESSION_COOKIE.replace(".", "\\.")}=([^;]+)`),
  )?.[1];

  if (!cookie) throw new Error("Session cookie missing from sign-in response");
  console.log(`<cookie>${cookie}</cookie>`);
}
