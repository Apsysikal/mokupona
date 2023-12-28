import { LoaderFunctionArgs, json } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { requireUserId } from "~/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  return json({});
}

export default function DinnersPage() {
  return (
    <>
      <Link to="dinners">Manage Dinners</Link>
    </>
  );
}
