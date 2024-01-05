import { Outlet } from "@remix-run/react";

export default function DinnersPage() {
  return (
    <div className="mx-auto max-w-3xl px-2">
      <Outlet />
    </div>
  );
}
