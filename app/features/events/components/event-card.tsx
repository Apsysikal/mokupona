import { Link } from "react-router";

import { formatEventMonthYear } from "../date-format";
import type { EventCardModel } from "../view-models";

import {
  EventDateHeading,
  EventLocationFact,
  EventPriceFact,
  EventSeatsFact,
} from "./event-facts";

import { CoverImage } from "~/components/cover-image";
import { SecondaryCTA } from "~/components/section";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";

export function FeaturedEventCard({
  event,
  isNext = true,
}: {
  event: EventCardModel;
  /** the "next dinner" pill belongs on the soonest dinner only */
  isNext?: boolean;
}) {
  return (
    <Card as="article" className="flex flex-col overflow-hidden lg:flex-row">
      <div className="relative lg:w-3/5 lg:shrink-0">
        <CoverImage
          image={event.image}
          alt=""
          sizes="(min-width: 1024px) 584px, 100vw"
          className="w-full"
        />
        {isNext ? (
          <Badge pill className="absolute top-4 left-4 lg:top-5 lg:left-5">
            next dinner
          </Badge>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-3 p-5 lg:p-8">
        <EventDateHeading date={event.date} />

        <h2 className="line-clamp-2 text-2xl leading-tight font-light tracking-tight">
          {event.title}
        </h2>

        <p className="text-foreground/80 line-clamp-3 text-sm font-light lg:line-clamp-2 lg:text-base">
          {event.description}
        </p>

        <div className="text-foreground/80 flex flex-wrap gap-4 border-y py-3 text-sm md:gap-6">
          <EventLocationFact addressLine={event.addressLine} />
          <EventPriceFact price={event.price} />
          <EventSeatsFact slots={event.slots} />
        </div>

        <div className="mt-1 flex flex-col gap-4 md:flex-row md:items-center md:gap-5">
          <Button asChild>
            <Link to={`/dinners/${event.id}#sign-up`}>reserve a seat</Link>
          </Button>
          <SecondaryCTA to={`/dinners/${event.id}`} className="max-md:hidden">
            read more →
          </SecondaryCTA>
        </div>
      </div>
    </Card>
  );
}

// quiet archive tile: image, month label, title
export function PastEventCard({ event }: { event: EventCardModel }) {
  const eventDate = new Date(event.date);

  return (
    <Link
      to={`/dinners/${event.id}`}
      className="flex flex-col gap-2 opacity-70 transition-opacity hover:opacity-100"
    >
      <CoverImage
        image={event.image}
        alt=""
        sizes="(min-width: 768px) 300px, 45vw"
        className="w-full rounded-2xl"
      />
      <span className="text-foreground/50 text-xs">
        <time dateTime={eventDate.toISOString()} suppressHydrationWarning>
          {formatEventMonthYear(eventDate)}
        </time>
      </span>
      <h4 className="text-base font-light md:text-lg">{event.title}</h4>
    </Link>
  );
}
