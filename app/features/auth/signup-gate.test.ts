// @vitest-environment node
// (happy-dom swaps the fetch primitives; Request/Response have to be real)

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  resetSignupSettings,
  setSignupEnabled,
} from "./signup-settings.server";

import { action } from "~/routes/api.auth.$";

// The pass-through case only needs to prove better-auth was handed the
// request — standing up the real handler would say nothing extra.
const mocks = vi.hoisted(() => ({ handler: vi.fn() }));

vi.mock("~/features/auth/auth.server", () => ({
  auth: { handler: mocks.handler },
  googleAuthEnabled: true,
}));

const DELEGATED = new Response("delegated");

afterEach(() => {
  resetSignupSettings();
  mocks.handler.mockReset();
});

function post(path: string) {
  mocks.handler.mockResolvedValue(DELEGATED);
  return action({
    request: new Request(`http://localhost:3000${path}`, { method: "POST" }),
  } as unknown as Parameters<typeof action>[0]);
}

describe("better-auth endpoint gate", () => {
  it("forwards registration while email signup is open", async () => {
    await expect(post("/api/auth/sign-up/email")).resolves.toBe(DELEGATED);
  });

  it("refuses registration with a 403 once email signup is closed", async () => {
    setSignupEnabled("email", false);

    const response = await post("/api/auth/sign-up/email");

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({
      code: "SIGNUP_DISABLED",
    });
    expect(mocks.handler).not.toHaveBeenCalled();
  });

  it("leaves every other endpoint alone while email signup is closed", async () => {
    setSignupEnabled("email", false);

    for (const path of [
      "/api/auth/sign-in/email",
      "/api/auth/sign-in/social",
      "/api/auth/forget-password",
    ]) {
      await expect(post(path)).resolves.toBe(DELEGATED);
    }
  });
});
