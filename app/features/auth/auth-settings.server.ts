import {
  AUTH_TOGGLES,
  type AuthSettings,
  type AuthToggle,
} from "./auth-settings";

import { singleton } from "~/utils/singleton.server";

const state = singleton<AuthSettings>("auth-settings", () => allEnabled());

function allEnabled(): AuthSettings {
  return Object.fromEntries(
    AUTH_TOGGLES.map((toggle) => [toggle, true]),
  ) as AuthSettings;
}

export function getAuthSettings(): AuthSettings {
  return { ...state };
}

export function isAuthToggleEnabled(toggle: AuthToggle): boolean {
  return state[toggle];
}

export function setAuthToggleEnabled(
  toggle: AuthToggle,
  enabled: boolean,
): AuthSettings {
  state[toggle] = enabled;
  return getAuthSettings();
}

export function resetAuthSettings(): AuthSettings {
  for (const toggle of AUTH_TOGGLES) state[toggle] = true;
  return getAuthSettings();
}
