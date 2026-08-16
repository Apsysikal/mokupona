import { Outlet } from "react-router";

import type { Route } from "./+types/dinners";

export const meta: Route.MetaFunction = () => [{ title: "Dinners" }];

export default function DinnersPage() {
  return <Outlet />;
}
