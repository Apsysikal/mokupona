import {
  SIGNUP_METHODS,
  type SignupMethod,
  type SignupSettings,
} from "./signup-settings";

import { singleton } from "~/utils/singleton.server";

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
