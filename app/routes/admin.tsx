import { LoaderFunctionArgs, json } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

import { requireUserId } from "~/session.server";
import { useUser } from "~/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  return json({});
}

export default function DinnersPage() {
  const user = useUser();

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-2 px-2">
      <div className="flex gap-4 justify-between">
        <span>Admin Section</span>
        <span>You are currently logged in as {user.email}</span>
      </div>
      <Outlet />
    </div>
  );
}
