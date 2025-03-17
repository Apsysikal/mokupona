import { Outlet } from "react-router";

import type { Route } from "./+types/dinners";

export const meta: Route.MetaFunction = () => [{ title: "Dinners" }];

export default function DinnersPage() {
  return (
    <div className="mx-auto max-w-4xl px-2">
      <Outlet />
    </div>
  );
}
