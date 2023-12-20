import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { DinnerCard } from "~/components/dinner-card";
import { Footer } from "~/components/footer";
import { NavBar } from "~/components/navbar";
import { getEvents } from "~/models/event.server";

export const loader = async ({ request }: LoaderArgs) => {
  const events = await getEvents();
  const preferredLocale =
    request.headers.get("accept-language")?.split(",")[0] || "de-DE";

  console.log(preferredLocale);

  return json({
    events,
    preferredLocale,
  });
};

export default function DinnersIndexRoute() {
  const { events, preferredLocale } = useLoaderData<typeof loader>();
  console.log(preferredLocale);

  return (
    <>
      <header>
        <NavBar />
      </header>
      <main className="mx-auto flex max-w-3xl grow flex-col gap-5 px-2 py-4 text-gray-800">
        {events.length > 0 ? (
          <>
            {events.map(({ id, attributes: event }) => {
              // @ts-ignore
              return (
                <DinnerCard
                  key={id}
                  id={id}
                  event={event}
                  preferredLocale={preferredLocale}
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
      <footer>
        <Footer />
      </footer>
    </>
  );
}