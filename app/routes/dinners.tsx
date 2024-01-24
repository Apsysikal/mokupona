import { MetaFunction } from "@remix-run/node";
import { Outlet } from "@remix-run/react";

export const meta: MetaFunction = () => [{ title: "Dinners" }];

export default function DinnersPage() {
  return (
    <div className="mx-auto max-w-3xl px-2">
      <Outlet />
    </div>
  );
}
