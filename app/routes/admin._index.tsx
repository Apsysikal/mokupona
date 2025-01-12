import { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link } from "react-router";

import { Button } from "~/components/ui/button";
import { useUser } from "~/utils/misc";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
  return {};
}

export const meta: MetaFunction<typeof loader> = () => {
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
      {isAdmin ? (
        <Button asChild>
          <Link to="users">Manage Users</Link>
        </Button>
      ) : null}
    </div>
  );
}
