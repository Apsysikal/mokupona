import { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useFetcher, useLoaderData } from "react-router";

import { Button } from "~/components/ui/button";
import { prisma } from "~/db.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["admin"]);
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      role: {
        select: {
          name: true,
        },
      },
    },
  });

  return { users };
}

export const meta: MetaFunction<typeof loader> = () => {
  return [{ title: "Admin - Users" }];
};

export default function DinnersPage() {
  const { users } = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-2">
      {users.length > 0 ? (
        <div className="flex flex-col gap-4">
          {users.map((user) => {
            return <User key={user.id} user={user} />;
          })}
        </div>
      ) : (
        <p>There are currently no users</p>
      )}
    </div>
  );
}

type User = Pick<Awaited<ReturnType<typeof loader>>, "users">["users"][number];

function User({ user }: { user: User }) {
  const deleteFetcher = useFetcher();
  const { id, email, role } = user;
  const isAdmin = role.name === "admin";
  const isDeleting = deleteFetcher.state !== "idle";

  return (
    <div key={id} className="flex items-center justify-between gap-2">
      <span className="text-sm font-medium leading-none">{email}</span>

      <span className="flex gap-2">
        <Button variant="secondary" asChild>
          <Link to={`${id}/edit`}>Edit</Link>
        </Button>

        <deleteFetcher.Form method="POST" action={`${id}/delete`}>
          <Button
            type="submit"
            disabled={isAdmin || isDeleting}
            variant="destructive"
          >
            {isDeleting ? "Deleting" : "Delete"}
          </Button>
        </deleteFetcher.Form>
      </span>
    </div>
  );
}
