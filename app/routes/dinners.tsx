import { MetaFunction } from "react-router";
import { Outlet } from "react-router";

export const meta: MetaFunction = () => [{ title: "Dinners" }];

export default function DinnersPage() {
  return (
    <div className="mx-auto max-w-4xl px-2">
      <Outlet />
    </div>
  );
}
