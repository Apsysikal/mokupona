import { LoaderFunctionArgs, json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { getEvents } from "~/models/event.server";
import { requireUserId } from "~/session.server";

export async function loader({ request }: LoaderFunctionArgs) {
  await requireUserId(request);
  const events = await getEvents();

  return json({ events });
}

export default function DinnersPage() {
  const { events } = useLoaderData<typeof loader>();

  return (
    <>
      <Link to="new">Create new dinner</Link>
      {events.length > 0 ? (
        <div className="flex flex-col gap-4">
          {events.map(({ id, title }) => {
            return (
              <Link key={id} to={id}>
                {title}
              </Link>
            );
          })}
        </div>
      ) : (
        <p>There are currently no dinners available</p>
      )}
    </>
  );
}
