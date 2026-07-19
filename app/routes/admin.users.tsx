import { Outlet } from "react-router";

import type { Route } from "./+types/admin.users";

import { narrowResolvedUserRoleMiddleware } from "~/features/auth/middleware.server";

// Narrows the segment to admins. The parent admin.tsx middleware already
// populated required userContext for every descendant, so this only checks
// the role — no second session or user lookup.
export const middleware: Route.MiddlewareFunction[] = [
  narrowResolvedUserRoleMiddleware(["admin"]),
];

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Users" }];
};

export default function LocationsPage() {
  return (
    <div className="flex flex-col gap-2">
      <Outlet />
    </div>
  );
}
