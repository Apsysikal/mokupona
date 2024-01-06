import { LoaderFunctionArgs, json } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { Button } from "~/components/ui/button";
import { requireUserWithRole } from "~/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
  return json({});
}

export default function DinnersPage() {
  return (
    <div className="flex flex-col gap-1">
      <Button asChild>
        <Link to="dinners">Manage Dinners</Link>
      </Button>
      <Button asChild>
        <Link to="locations">Manage Locations</Link>
      </Button>
    </div>
  );
}
