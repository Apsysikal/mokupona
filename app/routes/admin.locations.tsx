import { LoaderFunctionArgs, json } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import { requireUserId } from "~/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);

  return json({});
}

export default function LocationsPage() {
  return (
    <div className="flex flex-col gap-2">
      <div>Locations</div>
      <Outlet />
    </div>
  );
}
