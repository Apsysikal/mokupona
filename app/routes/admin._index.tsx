import { Link } from "react-router";

import type { Route } from "./+types/admin._index";

import { Button } from "~/components/ui/button";
import { useUser } from "~/utils/misc";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
  return {};
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin" }];
};

export default function DinnersPage() {
  const user = useUser();
  const isAdmin = user.role.name === "admin";

  return (
    <div className="flex flex-col gap-1">
      <Button asChild>
        <Link to="dinners">Manage Dinners</Link>
      </Button>
      <Button asChild>
        <Link to="locations">Manage Locations</Link>
      </Button>
      <Button asChild>
        <Link to="board-members/new">Board Members</Link>
      </Button>
      <Button asChild>
        <Link to="impressions">Manage Impressions</Link>
      </Button>
      {isAdmin ? (
        <Button asChild>
          <Link to="users">Manage Users</Link>
        </Button>
      ) : null}
    </div>
  );
}
