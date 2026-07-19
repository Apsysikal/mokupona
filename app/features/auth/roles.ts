// Client-safe role vocabulary. Prisma stores `Role.name` as a plain string,
// so the auth guards validate persisted names against this list before they
// flow into the app (plan phase 1).

export const ROLE_NAMES = ["user", "moderator", "admin"] as const;
export type RoleName = (typeof ROLE_NAMES)[number];

export const ADMIN_ROLE_NAMES = [
  "moderator",
  "admin",
] as const satisfies readonly RoleName[];

const ROLE_LABELS = {
  user: "user",
  moderator: "moderator",
  admin: "administrator",
} as const satisfies Record<RoleName, string>;

export const ROLE_FILTER_OPTIONS = [
  { label: "Admin", value: "admin" },
  { label: "Moderator", value: "moderator" },
  { label: "User", value: "user" },
] as const satisfies ReadonlyArray<{ label: string; value: RoleName }>;

export function isRoleName(value: string): value is RoleName {
  return ROLE_NAMES.some((role) => role === value);
}

export function roleLabel(value: string): string {
  return isRoleName(value) ? ROLE_LABELS[value] : value;
}

export function isAdminRole(value: string): boolean {
  return value === "admin";
}

/** Where a user lands after login or invite acceptance, by role. */
export function landingPathForRole(role: RoleName): string {
  return ADMIN_ROLE_NAMES.some((adminRole) => adminRole === role)
    ? "/admin"
    : "/";
}
