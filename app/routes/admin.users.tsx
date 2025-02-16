import type { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Outlet } from "react-router";

import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["admin"]);

  return {};
}

export const meta: MetaFunction<typeof loader> = () => {
  return [{ title: "Admin - Users" }];
};

export default function LocationsPage() {
  return (
    <div className="flex flex-col gap-2">
      <Outlet />
    </div>
  );
}
