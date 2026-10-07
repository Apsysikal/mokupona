import { Outlet } from "react-router";

import type { Route } from "./+types/admin.events";

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Events" }];
};

export default function EventsPage() {
  return (
    <div className="flex flex-col gap-2">
      <Outlet />
    </div>
  );
}
