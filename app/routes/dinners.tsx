import { Outlet } from "@remix-run/react";

export default function DinnersPage() {
  return (
    <div className="max-w-2xl mx-auto px-2">
      <div>Dinners</div>
      <Outlet />
    </div>
  );
}
