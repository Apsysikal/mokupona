import { json, LoaderArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { DinnerCard } from "~/components/dinner-card";
import { NavBar } from "~/components/navbar";

import { prisma } from "~/utilities/prisma.server";

export const loader = async () => {
  const events = await prisma.event.findMany();

  return json({
    events,
  });
};

export default function DinnersIndexRoute() {
  const { events } = useLoaderData<typeof loader>();

  return (
    <>
      <header>
        <NavBar className="text-white bg-emerald-800" />
      </header>
      <main className="flex flex-col max-w-3xl gap-5 grow mx-auto text-gray-800 px-2 py-4">
        {events.length > 0 ? (
          <>
            {events.map((event) => {
              event.date;

              return <DinnerCard event={event} />;
            })}
          </>
        ) : (
          <>
            <p className="text-4xl font-bold text-center">
              There are currently no dinners available.
            </p>
            <p className="text-xl font-semibold text-center textgray">
              Please come back later...
            </p>
          </>
        )}
      </main>
    </>
  );
}
