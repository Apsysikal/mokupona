import { CalendarIcon, PersonIcon, SewingPinIcon } from "@radix-ui/react-icons";
import { Link } from "react-router";

import { CreditCardIcon } from "./icons";
import { SecondaryCTA } from "./section";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

import {
  formatEventDateLine,
  formatEventMonthYear,
} from "~/features/events/date-format";
import type { Address, Event } from "~/models/event.server";
import { OptimizedImage } from "~/routes/file.$fileId";

// the one upcoming dinner gets the whole spotlight: image + pill on the
// left, date/title/stats/CTAs on the right (design handoff §2)
export function FeaturedDinnerCard({
  event,
  isNext = true,
}: {
  event: Event & { address: Address };
  /** the "next dinner" pill belongs on the soonest dinner only */
  isNext?: boolean;
}) {
  const eventDate = new Date(event.date);

  return (
    <article className="border-border bg-card flex flex-col overflow-hidden rounded-2xl border md:flex-row">
      <div className="relative min-h-44 md:min-h-80 md:w-[46%]">
        <OptimizedImage
          imageId={event.imageId}
          alt=""
          width={640}
          height={480}
          className="absolute inset-0 size-full object-cover"
        />
        {isNext ? (
          <Badge pill className="absolute top-4 left-4 md:top-5 md:left-5">
            next dinner
          </Badge>
        ) : null}
      </div>

      <div className="flex flex-col justify-center gap-3 p-5 md:w-[54%] md:gap-4 md:p-10">
        <span className="text-primary flex items-center gap-2 text-sm font-semibold">
          <CalendarIcon className="size-4" />
          <time dateTime={eventDate.toISOString()} suppressHydrationWarning>
            {formatEventDateLine(eventDate, "long")}
          </time>
        </span>

        <h2 className="text-2xl font-light tracking-tight md:text-3xl">
          {event.title}
        </h2>

        <p className="text-foreground/80 line-clamp-3 text-sm leading-relaxed font-light md:text-base">
          {event.description}
        </p>

        <div className="text-foreground/80 border-border flex flex-wrap gap-4 border-y py-3 text-sm md:gap-6">
          <span className="flex items-center gap-2">
            <SewingPinIcon className="text-foreground/50 size-4" />
            <span className="sr-only">location</span>
            {`${event.address.zip} ${event.address.city}`.toLowerCase()}
          </span>
          <span className="flex items-center gap-2">
            <CreditCardIcon className="text-foreground/50 size-4" />
            <span className="sr-only">price</span>
            {event.price} chf
          </span>
          <span className="flex items-center gap-2">
            <PersonIcon className="text-foreground/50 size-4" />
            {event.slots} seats
          </span>
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
    </article>
  );
}

// quiet archive tile: image, month label, title
export function PastDinnerCard({ event }: { event: Event }) {
  const eventDate = new Date(event.date);

  return (
    <Link
      to={`/dinners/${event.id}`}
      className="flex flex-col gap-2 opacity-70 transition-opacity hover:opacity-100"
    >
      <OptimizedImage
        imageId={event.imageId}
        alt=""
        width={640}
        height={480}
        className="h-28 w-full rounded-2xl object-cover md:h-32"
      />
      <span className="text-foreground/50 text-xs">
        <time dateTime={eventDate.toISOString()} suppressHydrationWarning>
          {formatEventMonthYear(eventDate)}
        </time>
      </span>
      <h4 className="text-base font-normal md:text-lg">{event.title}</h4>
    </Link>
  );
}
