import { Outlet } from "react-router";

import type { Route } from "./+types/admin.pages";

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Pages" }];
};

export default function AdminPagesRoute() {
  return <Outlet />;
}
