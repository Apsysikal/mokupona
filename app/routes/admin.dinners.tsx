import { Outlet } from "react-router";

import type { Route } from "./+types/admin.dinners";

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Dinners" }];
};

export default function DinnersPage() {
  return (
    <div className="flex flex-col gap-2">
      <Outlet />
    </div>
  );
}
