import { LoaderFunctionArgs, MetaFunction } from "react-router";
import { Link, useFetcher, useLoaderData } from "react-router";

import { Button } from "~/components/ui/button";
import { getEvents } from "~/models/event.server";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);
  const events = await getEvents();

  return { events };
}

export const meta: MetaFunction<typeof loader> = () => {
  return [{ title: "Admin - Dinners" }];
};

export default function DinnersPage() {
  const { events } = useLoaderData<typeof loader>();

  return (
    <div className="flex flex-col gap-4">
      {events.length > 0 ? (
        <div className="flex flex-col gap-4">
          {events.map(({ id, title }) => {
            return <Dinner key={id} id={id} title={title} />;
          })}
        </div>
      ) : (
        <p>There are currently no dinners available</p>
      )}

      <Button asChild>
        <Link to="new">Create new dinner</Link>
      </Button>
    </div>
  );
}

function Dinner({ id, title }: { id: string; title: string }) {
  const deleteFetcher = useFetcher();
  const isDeleting = deleteFetcher.state !== "idle";

  return (
    <div className="flex items-center justify-between gap-2">
      <Link to={id} className="text-sm font-medium leading-none">
        {title}
      </Link>

      <span className="flex gap-2">
        <Button variant="ghost" asChild>
          <Link to={`${id}/signups`}>View Signups</Link>
        </Button>

        <Button variant="secondary" asChild>
          <Link to={`${id}/edit`}>Edit</Link>
        </Button>

        <deleteFetcher.Form method="POST" action={`${id}/delete`}>
          <Button type="submit" variant="destructive" disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </deleteFetcher.Form>
      </span>
    </div>
  );
}
