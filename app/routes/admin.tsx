import { Outlet } from "react-router";

import type { Route } from "./+types/admin";

import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: Route.ActionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
  return {};
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin" }];
};

export default function DinnersPage() {
  return (
    <div className="mx-auto mt-8 max-w-4xl px-2">
      <Outlet />
    </div>
  );
}
