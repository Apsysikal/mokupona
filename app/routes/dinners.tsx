import { Outlet } from "react-router";

import type { Route } from "./+types/dinners";

export const meta: Route.MetaFunction = () => [{ title: "Dinners" }];

export default function DinnersPage() {
  // child pages own their layout (the redesigned list and detail pages use
  // different column widths)
  return <Outlet />;
}
