import { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
  return {};
}

export const meta: MetaFunction<typeof loader> = () => {
  return [{ title: "Admin" }];
};

export default function DinnersPage() {
  return (
    <div className="mx-auto mt-8 max-w-4xl px-2">
      <Outlet />
    </div>
  );
}
