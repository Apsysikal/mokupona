import { Outlet } from "react-router";

import type { Route } from "./+types/admin.users";

import { requireRoleMiddleware } from "~/features/auth/middleware.server";

// Narrows the segment to admins. The parent admin.tsx middleware already
// authenticated the request and populated userContext, so this only
// re-checks the role — no second session or user lookup (plan phase 2).
export const middleware: Route.MiddlewareFunction[] = [
  requireRoleMiddleware(["admin"]),
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
