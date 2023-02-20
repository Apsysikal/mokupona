import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { DinnerCard } from "~/components/dinner-card";
import { Footer } from "~/components/footer";
import { NavBar } from "~/components/navbar";
import { getEvents } from "~/models/event.server";

export const loader = async () => {
  return json({
    events: await getEvents(),
  });
};

export default function DinnersIndexRoute() {
  const { events } = useLoaderData<typeof loader>();

  return (
    <>
      <header>
        <NavBar className="bg-emerald-800 text-white" />
      </header>
      <main className="mx-auto flex max-w-3xl grow flex-col gap-5 px-2 py-4 text-gray-800">
        {events.length > 0 ? (
          <>
            {events.map((event) => {
              const parsedEvent = {
                ...event,
                date: new Date(event.date),
                signupDate: new Date(event.signupDate),
              };

              return <DinnerCard event={parsedEvent} />;
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
      <footer>
        <Footer />
      </footer>
    </>
  );
}
