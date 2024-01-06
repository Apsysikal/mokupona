import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import { DinnerCard } from "~/components/dinner-card";
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
    <main className="flex grow flex-col gap-5 py-4">
      {events.length > 0 ? (
        <>
          {events.map((event) => {
            return (
              <DinnerCard
                key={event.id}
                event={event}
                preferredLocale={"de-CH"}
              />
            );
          })}
        </>
      ) : (
        <>
          <p className="text-center text-4xl font-bold">
            There are currently no dinners available.
          </p>
          <p className="textgray text-center text-xl font-semibold">
            Please come back later...
          </p>
        </>
      )}
    </main>
  );
}
