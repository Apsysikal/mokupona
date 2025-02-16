import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Outlet } from "react-router";

import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  return {};
}

export const meta: MetaFunction<typeof loader> = () => {
  return [{ title: "Admin - Dinners" }];
};

export default function DinnersPage() {
  return (
    <div className="flex flex-col gap-2">
      <Outlet />
    </div>
  );
}
