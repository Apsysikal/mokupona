import type { Event } from "@prisma/client";
import { Link } from "react-router";

import { Button } from "./ui/button";

import { OptimizedImage } from "~/routes/file.$fileId";
import { dateFormatBuilder } from "~/utils/misc";

export function DinnerCard({
  event,
  preferredLocale = "de-CH",
}: {
  event: Event;
  preferredLocale?: string;
}) {
  const dateFormatter = dateFormatBuilder(preferredLocale);

  return (
    <div className="relative mx-auto w-full overflow-hidden">
      <OptimizedImage
        imageId={event.imageId}
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

        <div className="text-primary text-3xl">{event.title}</div>

        <div>
          <p className="line-clamp-5">{event.description}</p>
        </div>
        <div className="flex items-center justify-between">
          <Button asChild>
            <Link to={`/dinners/${event.id}`}>Read more</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
