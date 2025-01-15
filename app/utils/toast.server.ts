import { createCookieSessionStorage, redirect } from "react-router";
import invariant from "tiny-invariant";
import { z } from "zod";

import { combineHeaders } from "./misc";

invariant(process.env.SESSION_SECRET, "SESSION_SECRET must be set");

const TOAST_COOKIE_KEY = "__toast";
const TOAST_SESSION_KEY = "toast";

const ToastSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  type: z.enum(["message", "success", "error"]).default("message"),
});

export type Toast = z.infer<typeof ToastSchema>;
export type ToastInput = z.input<typeof ToastSchema>;

export const toastSessionStorage = createCookieSessionStorage({
  cookie: {
    name: TOAST_COOKIE_KEY,
    httpOnly: true,
    path: "/",
    sameSite: "lax",
    secrets: [process.env.SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function redirectWithToast(
  url: string,
  toast: ToastInput,
  init?: ResponseInit,
) {
  const session = await getToastSession();
  session.flash(TOAST_SESSION_KEY, toast);
  const headers = await getToastCommitHeaders(session, init);
  return redirect(url, {
    headers,
  });
}

export async function getToast(request: Request) {
  const session = await getToastSession(request);
  const toast = await getToastContent(session);
  const headers = await getToastDestroyHeaders(toast, session);
  return { toast, headers };
}

async function getToastSession(request?: Request) {
  if (!request) return await toastSessionStorage.getSession();
  const cookieHeader = request.headers.get("cookie");
  return await toastSessionStorage.getSession(cookieHeader);
}

async function getToastContent(
  session: Awaited<ReturnType<typeof getToastSession>>,
) {
  const result = ToastSchema.safeParse(session.get(TOAST_SESSION_KEY));
  return result.success ? result.data : null;
}

async function getToastCommitHeaders(
  session: Awaited<ReturnType<typeof getToastSession>>,
  init?: ResponseInit,
) {
  const cookie = await toastSessionStorage.commitSession(session);
  const header = new Headers({ "set-cookie": cookie });
  return combineHeaders(init?.headers, header);
}

async function getToastDestroyHeaders(
  toast: Toast | null,
  session: Awaited<ReturnType<typeof getToastSession>>,
) {
  if (!toast) return null;
  return new Headers({
    "set-cookie": await toastSessionStorage.destroySession(session),
  });
}
