import type { RoleName } from "~/features/auth/roles";

// Client-safe invite constants (the admin dialog validates against them in
// the browser). Ceiling "moderator": admin is a seed/DB-level role and can
// never be granted by invite — the server re-enforces this (design §6).
export const INVITABLE_ROLES = [
  "user",
  "moderator",
] as const satisfies readonly RoleName[];
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

function isInvitableRole(value: string): value is InvitableRole {
  return INVITABLE_ROLES.some((role) => role === value);
}

export function normalizeInvitableRole(value: string): InvitableRole {
  return isInvitableRole(value) ? value : "user";
}

export const INVITABLE_ROLE_OPTIONS = [
  { label: "User", value: "user" },
  { label: "Moderator", value: "moderator" },
] as const satisfies ReadonlyArray<{ label: string; value: InvitableRole }>;
