import type { Event } from "@prisma/client";
import type { SerializeFrom } from "@remix-run/node";
import { Link } from "@remix-run/react";

import { getEventImageUrl } from "~/utils/misc";

import { Button } from "./ui/button";

export function DinnerCard({
  event,
  preferredLocale,
}: {
  event: Event | SerializeFrom<Event>;
  preferredLocale: string;
}) {
  const parsedDate = new Date(event.date);
  const imageUrl = getEventImageUrl(event.imageId);

  return (
    <div className="relative mx-auto w-full overflow-hidden rounded-lg border border-border bg-muted shadow-lg">
      <img
        src={imageUrl}
        alt=""
        width={640}
        height={480}
        className="max-h-28 w-full object-cover object-center"
      />
      <div className="flex flex-col gap-3 p-5">
        <div>
          <strong className="text-3xl">{event.title}</strong>
        </div>

        <div>
          <time
            className="text-sm font-semibold text-primary"
            dateTime={parsedDate.toISOString()}
            suppressHydrationWarning
          >
            {`${parsedDate.toLocaleDateString(
              preferredLocale,
            )} - ${parsedDate.toLocaleTimeString(preferredLocale)}`}
          </time>
        </div>
        <div>
          <p className="line-clamp-5">{event.description}</p>
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
