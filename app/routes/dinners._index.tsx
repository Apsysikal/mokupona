import { useLoaderData } from "react-router";

import type { Route } from "./+types/dinners._index";

import { DinnerCard } from "~/components/dinner-card";
import { getEvents } from "~/models/event.server";

export const loader = async () => {
  const events = await getEvents();

  return { events };
};

export const meta: Route.MetaFunction = () => [{ title: "Dinners" }];

export default function DinnersIndexPage() {
  const { events } = useLoaderData<typeof loader>();

  const upcomingEvents = events.filter((event) => {
    const eventDate = new Date(event.date);
    const now = new Date();
    return eventDate >= now;
  });

  const pastEvents = events.filter((event) => {
    const eventDate = new Date(event.date);
    const now = new Date();
    return eventDate < now;
  });

  return (
    <main className="mt-16 flex grow flex-col py-4">
      {upcomingEvents.length > 0 || pastEvents.length > 0 ? (
        <>
          {upcomingEvents.length > 0 ? (
            <div className="flex flex-col gap-8">
              <h2 className="text-4xl">Upcoming dinners</h2>
              <div className="flex flex-col gap-16">
                {upcomingEvents.map((event) => {
                  return <DinnerCard key={event.id} event={event} />;
                })}
              </div>
            </div>
          ) : null}

          {pastEvents.length > 0 ? (
            <div className="flex flex-col gap-8">
              {upcomingEvents.length > 0 ? <hr className="my-16" /> : null}
              <h2 className="text-4xl">Past dinners</h2>
              <div className="flex flex-col gap-16">
                {pastEvents.map((event) => {
                  return <DinnerCard key={event.id} event={event} />;
                })}
              </div>
            </div>
          ) : null}
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
