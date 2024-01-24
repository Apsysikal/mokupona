import { LoaderFunctionArgs, MetaFunction, json } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import { requireUserWithRole } from "~/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  return json({});
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
