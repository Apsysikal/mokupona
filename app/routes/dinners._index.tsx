import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";

import { getEvents } from "~/models/event.server";

export const loader = async () => {
  const events = await getEvents({
    date: {
      gte: new Date(),
    },
  });

  return json({ events });
};

export default function DinnersIndexPage() {
  const { events } = useLoaderData<typeof loader>();

  return (
    <>
      {events.length > 0 ? (
        <>
          {events.map(({ id, title }) => {
            return (
              <Link key={id} to={id}>
                {title}
              </Link>
            );
          })}
        </>
      ) : (
        <p>There are currently no dinners available</p>
      )}
    </>
  );
}
