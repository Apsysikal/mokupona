// Client-safe invite constants (the admin dialog validates against them in
// the browser). Ceiling "moderator": admin is a seed/DB-level role and can
// never be granted by invite — the server re-enforces this (design §6).
export const INVITABLE_ROLES = ["user", "moderator"] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number];

export function isInvitableRole(value: string): value is InvitableRole {
  return (INVITABLE_ROLES as readonly string[]).includes(value);
}
