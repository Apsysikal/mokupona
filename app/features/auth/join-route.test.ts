// @vitest-environment node
// (happy-dom swaps the fetch primitives; better-auth needs the real ones)

import { RouterContextProvider } from "react-router";
import { afterEach, describe, expect, it } from "vitest";

import { SIGNUP_CLOSED_MESSAGE } from "./signup-settings";
import {
  resetSignupSettings,
  setSignupEnabled,
} from "./signup-settings.server";

import {
  HONEYPOT_FIELD_NAME,
  HONEYPOT_VALID_FROM_FIELD_NAME,
} from "~/features/forms/honeypot";
import { getHoneypotInputProps } from "~/features/forms/honeypot.server";
import { getUserByEmail } from "~/models/user.server";
import { action } from "~/routes/join";

const VALID_SIGNUP = {
  name: "lena huber",
  email: "closed-signup@example.com",
  password: "correct-horse-battery",
  confirmPassword: "correct-horse-battery",
};

const SPAM_EMAIL = "spam-trap@example.com";

// every browser submission carries the spam-trap fields — with the trap
// itself left blank — so tests of the rest of the action must too
function fromBrowser(body: Record<string, string> = {}) {
  return {
    [HONEYPOT_FIELD_NAME]: "",
    [HONEYPOT_VALID_FROM_FIELD_NAME]: getHoneypotInputProps().validFrom,
    ...body,
  };
}

function fromBot() {
  return fromBrowser({
    ...VALID_SIGNUP,
    email: SPAM_EMAIL,
    [HONEYPOT_FIELD_NAME]: "https://buy-cheap-pills.example",
  });
}

async function expectFakeSuccess(result: Awaited<ReturnType<typeof action>>) {
  // a redirect, not a conform reply — the bot gets nothing to read
  expect(result).toBeInstanceOf(Response);
  const response = result as Response;
  expect(response.status).toBe(302);
  expect(response.headers.get("location")).toBe(
    `/check-your-inbox?email=${encodeURIComponent(SPAM_EMAIL)}`,
  );
  expect(await getUserByEmail(SPAM_EMAIL)).toBeNull();
}

afterEach(() => {
  resetSignupSettings();
});

function submit(body: Record<string, string>) {
  return action({
    request: new Request("http://localhost:3000/join", {
      method: "POST",
      body: new URLSearchParams(body),
    }),
    context: new RouterContextProvider(),
  } as unknown as Parameters<typeof action>[0]);
}

// The action returns either a bare conform reply or one wrapped by `data()`
// to carry a status — read both through the same lens.
function readReply(result: Awaited<ReturnType<typeof action>>) {
  const wrapped = result as {
    init?: ResponseInit | null;
    data?: { error?: Record<string, string[] | null> | null };
    error?: Record<string, string[] | null> | null;
  };
  const reply = wrapped.data ?? wrapped;

  return {
    status: wrapped.init?.status ?? 200,
    formErrors: reply.error?.[""] ?? [],
  };
}

describe("join action", () => {
  it("rejects a direct post with a 403 once email signup is closed", async () => {
    setSignupEnabled("email", false);

    // an otherwise perfectly valid submission — only the toggle stops it
    expect(readReply(await submit(fromBrowser(VALID_SIGNUP)))).toEqual({
      status: 403,
      formErrors: [SIGNUP_CLOSED_MESSAGE],
    });
  });

  it("leaves account creation alone while email signup is open", async () => {
    // an empty submission fails validation before better-auth is reached, so
    // this proves the gate is open without provisioning a user
    expect(readReply(await submit(fromBrowser()))).toEqual({
      status: 200,
      formErrors: [],
    });
  });

  it("keeps email signup open when only google signup is closed", async () => {
    setSignupEnabled("google", false);

    expect(readReply(await submit(fromBrowser())).status).toBe(200);
  });

  it("answers a filled spam trap with the success redirect", async () => {
    await expectFakeSuccess(await submit(fromBot()));
  });

  it("answers a filled spam trap identically once signup is closed", async () => {
    setSignupEnabled("email", false);

    // the trap is checked first, so a bot cannot probe the toggle either
    await expectFakeSuccess(await submit(fromBot()));
  });
});
