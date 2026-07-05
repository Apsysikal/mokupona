import { CalendarIcon, PersonIcon, SewingPinIcon } from "@radix-ui/react-icons";
import { Link } from "react-router";

import { CreditCardIcon } from "./icons";
import { Button } from "./ui/button";

import type { Address, Event } from "~/models/event.server";
import { OptimizedImage } from "~/routes/file.$fileId";
import { formatEventDateLine, formatEventMonthYear } from "~/utils/misc";

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
    <article className="border-foreground/12 bg-card flex flex-col overflow-hidden rounded-2xl border md:flex-row">
      <div className="relative min-h-[180px] md:min-h-[340px] md:w-[44%]">
        <OptimizedImage
          imageId={event.imageId}
          alt=""
          width={640}
          height={480}
          className="absolute inset-0 size-full object-cover"
        />
        {isNext ? (
          <span className="bg-primary text-primary-foreground absolute top-3.5 left-3.5 inline-flex h-6.5 items-center rounded-full px-3 text-xs font-bold md:top-5 md:left-5 md:h-7.5">
            next dinner
          </span>
        ) : null}
      </div>

      <div className="flex flex-col justify-center gap-3 p-5.5 md:w-[56%] md:gap-4.5 md:p-10">
        <span className="text-primary flex items-center gap-2 text-xs font-semibold md:text-[13px]">
          <CalendarIcon className="size-[15px]" />
          <time dateTime={eventDate.toISOString()} suppressHydrationWarning>
            {formatEventDateLine(eventDate, "long")}
          </time>
        </span>

        <h2 className="text-[26px] leading-[1.1] font-light lowercase md:text-[34px]">
          {event.title}
        </h2>

        <p className="text-fg-secondary line-clamp-3 text-sm leading-relaxed font-light md:text-base">
          {event.description}
        </p>

        <div className="text-fg-secondary border-foreground/10 flex flex-wrap gap-4 border-y py-3.5 text-[13px] md:gap-6.5 md:text-sm">
          <span className="flex items-center gap-1.5">
            <SewingPinIcon className="text-fg-label size-[15px]" />
            <span className="sr-only">location</span>
            {`${event.address.zip} ${event.address.city}`.toLowerCase()}
          </span>
          <span className="flex items-center gap-1.5">
            <CreditCardIcon className="text-fg-label size-[15px]" />
            <span className="sr-only">price</span>
            {event.price} chf
          </span>
          <span className="flex items-center gap-1.5">
            <PersonIcon className="text-fg-label size-[15px]" />
            {event.slots} seats
          </span>
        </div>

        <div className="mt-0.5 flex flex-col gap-4 md:flex-row md:items-center md:gap-5.5">
          <Button asChild>
            <Link to={`/dinners/${event.id}#sign-up`}>reserve a seat</Link>
          </Button>
          <Link
            to={`/dinners/${event.id}`}
            className="border-foreground/35 hover:border-foreground w-fit border-b pb-0.5 text-[15px] max-md:hidden"
          >
            read more →
          </Link>
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
      className="flex flex-col gap-2.5 opacity-70 transition-opacity hover:opacity-100"
    >
      <OptimizedImage
        imageId={event.imageId}
        alt=""
        width={640}
        height={480}
        className="h-[100px] w-full rounded-xl object-cover md:h-[130px]"
      />
      <span className="text-fg-label text-[11px]">
        <time dateTime={eventDate.toISOString()} suppressHydrationWarning>
          {formatEventMonthYear(eventDate)}
        </time>
      </span>
      <h4 className="text-[15px] font-normal lowercase md:text-[17px]">
        {event.title}
      </h4>
    </Link>
  );
}
