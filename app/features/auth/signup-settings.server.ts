import {
  SIGNUP_METHODS,
  type SignupMethod,
  type SignupSettings,
} from "./signup-settings";

import { singleton } from "~/utils/singleton.server";

// Process-local state, deliberately: the toggles are a stop-gap switch for
// closing self-signup, not persisted configuration. Every deploy or restart
// re-opens both methods, and a multi-instance deployment would have to be
// toggled per instance — move this into the database before either matters.
const state = singleton<SignupSettings>("signup-settings", () => allEnabled());

function allEnabled(): SignupSettings {
  return Object.fromEntries(
    SIGNUP_METHODS.map((method) => [method, true]),
  ) as SignupSettings;
}

/** A snapshot for loaders — mutating it does not touch the live state. */
export function getSignupSettings(): SignupSettings {
  return { ...state };
}

export function isSignupEnabled(method: SignupMethod): boolean {
  return state[method];
}

export function setSignupEnabled(
  method: SignupMethod,
  enabled: boolean,
): SignupSettings {
  state[method] = enabled;
  return getSignupSettings();
}

/** Test-only escape hatch: back to "everything open". */
export function resetSignupSettings(): SignupSettings {
  for (const method of SIGNUP_METHODS) state[method] = true;
  return getSignupSettings();
}
