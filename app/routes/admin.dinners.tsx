import { LoaderFunctionArgs, json } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import { requireUserWithRole } from "~/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  return json({});
}

export default function DinnersPage() {
  return (
    <div className="flex flex-col gap-2">
      <Outlet />
    </div>
  );
}
