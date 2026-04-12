import { Outlet } from "react-router";

export default function AdminPagesRoute() {
  return (
    <div className="flex flex-col gap-2">
      <Outlet />
    </div>
  );
}
