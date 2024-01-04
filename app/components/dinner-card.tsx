import type { Event } from "@prisma/client";
import type { SerializeFrom } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { Button } from "./ui/button";

export function DinnerCard({
  event,
  preferredLocale,
}: {
  event: Event | SerializeFrom<Event>;
  preferredLocale: string;
}) {
  const parsedDate = new Date(event.date);

  return (
    <div className="relative mx-auto overflow-hidden rounded-lg border border-gray-200 shadow-lg">
      <img
        src={event.cover}
        alt=""
        width={640}
        height={480}
        className="max-h-28 w-full object-cover"
      />
      <div className="flex flex-col gap-3 p-5">
        <div>
          <strong className="text-3xl text-gray-900">{event.title}</strong>
        </div>

        <div>
          <time
            className="text-sm font-semibold text-emerald-600"
            dateTime={parsedDate.toISOString()}
            suppressHydrationWarning
          >
            {`${parsedDate.toLocaleDateString(
              preferredLocale,
            )} - ${parsedDate.toLocaleTimeString(preferredLocale)}`}
          </time>
        </div>
        <div>
          <p className="text-gray-900 line-clamp-5">{event.description}</p>
        </div>
        <div className="flex items-center justify-between">
          <Button asChild>
            <Link to={`/dinners/${event.id}`}>Join</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
