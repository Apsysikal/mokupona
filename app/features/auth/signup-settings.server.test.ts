import { afterEach, describe, expect, it } from "vitest";

import {
  getSignupSettings,
  isSignupEnabled,
  resetSignupSettings,
  setSignupEnabled,
} from "./signup-settings.server";

afterEach(() => {
  resetSignupSettings();
});

describe("signup settings store", () => {
  it("leaves every method open until something closes one", () => {
    expect(getSignupSettings()).toEqual({ email: true, google: true });
  });

  it("closes methods independently of each other", () => {
    setSignupEnabled("email", false);

    expect(isSignupEnabled("email")).toBe(false);
    expect(isSignupEnabled("google")).toBe(true);

    setSignupEnabled("google", false);
    setSignupEnabled("email", true);

    expect(getSignupSettings()).toEqual({ email: true, google: false });
  });

  it("hands loaders a snapshot they cannot write back through", () => {
    const snapshot = getSignupSettings();
    snapshot.email = false;

    expect(isSignupEnabled("email")).toBe(true);
  });
});
