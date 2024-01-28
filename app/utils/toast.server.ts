import { createCookieSessionStorage, redirect } from "@remix-run/node";
import invariant from "tiny-invariant";
import { z } from "zod";

import { combineHeaders } from "~/utils";

invariant(process.env.SESSION_SECRET, "SESSION_SECRET must be set");

const cookieKey = "toast";
const toastKey = "en_toast";
const ToastSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  type: z.enum(["message", "success", "error"]).default("message"),
});

export type Toast = z.infer<typeof ToastSchema>;
export type ToastInput = z.input<typeof ToastSchema>;

export const toastStorage = createCookieSessionStorage({
  cookie: {
    name: cookieKey,
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
  const session = await toastStorage.getSession();
  session.flash(toastKey, toast);
  const cookie = await toastStorage.commitSession(session);
  const header = new Headers({ "set-cookie": cookie });
  const combinedHeaders = combineHeaders(init?.headers, header);
  return redirect(url, {
    headers: combinedHeaders,
  });
}

export async function getToast(request: Request) {
  const cookieHeader = request.headers.get("cookie");
  const session = await toastStorage.getSession(cookieHeader);
  const result = ToastSchema.safeParse((await session).get(toastKey));
  const toast = result.success ? result.data : null;
  return {
    toast,
    headers: toast
      ? new Headers({
          "set-cookie": await toastStorage.destroySession(session),
        })
      : null,
  };
}
