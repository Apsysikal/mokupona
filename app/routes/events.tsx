import { Outlet } from "react-router";

import type { Route } from "./+types/events";

export const meta: Route.MetaFunction = () => [{ title: "Events" }];

export default function EventsPage() {
  return <Outlet />;
}
