import { LoaderFunctionArgs, json } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { requireUserId } from "~/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  return json({});
}

export default function DinnersPage() {
  return (
    <div className="flex flex-col gap-1">
      <Link to="dinners">Manage Dinners</Link>
      <Link to="locations">Manage Locations</Link>
    </div>
  );
}
