import { useLoaderData } from "react-router";

import type { Route } from "./+types/dinners._index";

import { DinnerCard } from "~/components/dinner-card";
import { getEvents } from "~/models/event.server";

export const loader = async () => {
  const events = await getEvents({
    date: {
      gte: new Date(),
    },
  });

  return { events };
};

export const meta: Route.MetaFunction = () => [{ title: "Dinners" }];

export default function DinnersIndexPage() {
  const { events } = useLoaderData<typeof loader>();

  return (
    <main className="mt-16 flex grow flex-col gap-32 py-4">
      {events.length > 0 ? (
        <>
          {events.map((event) => {
            return <DinnerCard key={event.id} event={event} />;
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
