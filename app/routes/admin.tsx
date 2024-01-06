import { LoaderFunctionArgs, json } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import { requireUserWithRole } from "~/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
  return json({});
}

export default function DinnersPage() {
  return (
    <div className="mx-auto mt-8 max-w-3xl px-2">
      <Outlet />
    </div>
  );
}
