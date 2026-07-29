// @vitest-environment node
// (happy-dom swaps the fetch primitives; better-auth needs the real ones)

import { afterEach, describe, expect, it } from "vitest";

import { buildGoogleProviderOptions } from "./auth.server";
import {
  resetSignupSettings,
  setSignupEnabled,
} from "./signup-settings.server";

afterEach(() => {
  resetSignupSettings();
});

describe("google provider signup switches", () => {
  it("stays open to registration while google signup is enabled", () => {
    const options = buildGoogleProviderOptions("client-id", "client-secret");

    expect(options.disableSignUp).toBe(false);
    expect(options.disableIdTokenSignIn).toBe(false);
  });

  it("closes registration on the object better-auth already holds", () => {
    // built before the toggle flips, exactly like the real boot-time provider
    const options = buildGoogleProviderOptions("client-id", "client-secret");

    setSignupEnabled("google", false);

    expect(options.disableSignUp).toBe(true);
    expect(options.disableIdTokenSignIn).toBe(true);
  });

  it("ignores the email toggle", () => {
    const options = buildGoogleProviderOptions("client-id", "client-secret");

    setSignupEnabled("email", false);

    expect(options.disableSignUp).toBe(false);
  });
});
