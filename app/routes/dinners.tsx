import { Outlet } from "@remix-run/react";

export default function DinnersPage() {
  return (
    <>
      <div>Dinners</div>
      <Outlet />
    </>
  );
}
