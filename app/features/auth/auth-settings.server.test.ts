import { afterEach, describe, expect, it } from "vitest";

import {
  getAuthSettings,
  isAuthToggleEnabled,
  resetAuthSettings,
  setAuthToggleEnabled,
} from "./auth-settings.server";

afterEach(() => {
  resetAuthSettings();
});

describe("auth settings store", () => {
  it("leaves every toggle open until something closes one", () => {
    expect(getAuthSettings()).toEqual({ emailSignup: true, google: true });
  });

  it("closes toggles independently of each other", () => {
    setAuthToggleEnabled("emailSignup", false);

    expect(isAuthToggleEnabled("emailSignup")).toBe(false);
    expect(isAuthToggleEnabled("google")).toBe(true);

    setAuthToggleEnabled("google", false);
    setAuthToggleEnabled("emailSignup", true);

    expect(getAuthSettings()).toEqual({ emailSignup: true, google: false });
  });

  it("hands loaders a snapshot they cannot write back through", () => {
    const snapshot = getAuthSettings();
    snapshot.emailSignup = false;

    expect(isAuthToggleEnabled("emailSignup")).toBe(true);
  });
});
