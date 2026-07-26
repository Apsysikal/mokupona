import type { RoleName } from "~/features/auth/roles";

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
