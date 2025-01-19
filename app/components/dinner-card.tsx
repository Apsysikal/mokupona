import type { Event } from "@prisma/client";
import { Link } from "react-router";

import { Button } from "./ui/button";

import { dateFormatBuilder, getEventImageUrl } from "~/utils/misc";

export function DinnerCard({
  event,
  preferredLocale = "de-CH",
}: {
  event: Event;
  preferredLocale?: string;
}) {
  const imageUrl = getEventImageUrl(event.imageId);
  const dateFormatter = dateFormatBuilder(preferredLocale);

  return (
    <div className="relative mx-auto w-full overflow-hidden">
      <img
        src={imageUrl}
        alt=""
        width={640}
        height={480}
        className="max-h-96 w-full rounded-xl object-cover object-center"
      />
      <div className="mt-5 flex flex-col gap-7 p-5">
        <div>
          <time
            className="text-sm"
            dateTime={event.date.toISOString()}
            suppressHydrationWarning
          >
            {dateFormatter.format(event.date)}
          </time>
        </div>

        <div className="text-3xl text-primary">{event.title}</div>

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
