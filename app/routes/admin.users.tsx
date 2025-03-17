import { Outlet } from "react-router";

import type { Route } from "./+types/admin.users";

import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["admin"]);

  return {};
}

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
