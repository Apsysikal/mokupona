import { Outlet } from "react-router";

import type { Route } from "./+types/admin.users";

import { requireResolvedUserRoleMiddleware } from "~/features/auth/middleware.server";

export const middleware: Route.MiddlewareFunction[] = [
  requireResolvedUserRoleMiddleware(["admin"]),
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
