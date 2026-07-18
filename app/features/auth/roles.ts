// Client-safe role vocabulary. Prisma stores `Role.name` as a plain string,
// so the auth guards validate persisted names against this list before they
// flow into the app (plan phase 1).

export const ROLE_NAMES = ["user", "moderator", "admin"] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export const ADMIN_ROLE_NAMES = [
  "moderator",
  "admin",
] as const satisfies readonly RoleName[];

export function isRoleName(value: string): value is RoleName {
  return (ROLE_NAMES as readonly string[]).includes(value);
}

/** Where a user lands after login or invite acceptance, by role. */
export function landingPathForRole(role: RoleName): string {
  return (ADMIN_ROLE_NAMES as readonly string[]).includes(role)
    ? "/admin"
    : "/";
}
