import { Outlet } from "react-router";

import type { Route } from "./+types/admin.dinners";

import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  return {};
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Dinners" }];
};

export default function DinnersPage() {
  return (
    <div className="flex flex-col gap-2">
      <Outlet />
    </div>
  );
}
