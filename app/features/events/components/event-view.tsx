import { CalendarIcon, InfoCircledIcon } from "@radix-ui/react-icons";

import { formatEventDateLine } from "../date-format";
import type { EventDetailModel } from "../view-models";

import {
  EventDateHeading,
  EventLocationFact,
  EventPriceFact,
  EventSeatsFact,
} from "./event-facts";

import { AutoLink } from "~/components/auto-link";
import { OptimizedImage } from "~/components/optimized-image";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "~/components/ui/accordion";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";

export interface EventViewProps {
  event: EventDetailModel;
}

// the editorial left column of the dinner detail page: photo, date, title,
// story, and the menu/donation accordions (design handoff §3)
export function EventStory({ event }: EventViewProps) {
  const menuLines = event.menuDescription
    ?.split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return (
    <div className="flex flex-col gap-5 md:gap-6">
      <OptimizedImage
        imageId={event.imageId}
        alt=""
        width={640}
        height={480}
        className="h-64 w-full rounded-2xl object-cover md:h-96"
      />

      <div className="flex flex-col gap-3">
        <EventDateHeading date={event.date} />
        <h1 className="text-3xl font-light tracking-tight md:text-4xl">
          {event.title}
        </h1>
      </div>

      <p className="text-foreground/80 text-base leading-relaxed font-light whitespace-pre-line md:text-lg">
        <AutoLink text={event.description} />
      </p>

      {menuLines?.length || event.donationDescription ? (
        <Accordion
          type="single"
          collapsible
          defaultValue="menu"
          className="border-border mt-2 w-full border-t"
        >
          {menuLines?.length ? (
            <AccordionItem value="menu" className="border-border">
              <AccordionTrigger className="text-primary">menu</AccordionTrigger>
              <AccordionContent className="pb-6">
                <div className="flex flex-col gap-3">
                  {menuLines.map((line, index) => (
                    <div
                      key={index}
                      className="text-foreground/80 flex gap-3 text-base leading-relaxed font-light"
                    >
                      <span className="text-foreground/40 pt-0.5 font-mono text-sm">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span>
                        <AutoLink text={line} />
                      </span>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {event.donationDescription ? (
            <AccordionItem value="donation" className="border-border">
              <AccordionTrigger className="text-primary">
                donation
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <p className="text-foreground/80 text-base leading-relaxed font-light whitespace-pre-line">
                  <AutoLink text={event.donationDescription} />
                </p>
              </AccordionContent>
            </AccordionItem>
          ) : null}
        </Accordion>
      ) : null}
    </div>
  );
}

// date / location / price / seats rows used in the booking card and the
// admin preview
export function EventFactList({ event }: EventViewProps) {
  const eventDate = new Date(event.date);

  return (
    <div className="text-foreground/80 flex flex-col gap-3 text-sm">
      <span className="flex items-center gap-2">
        <CalendarIcon className="text-foreground/50 size-4" />
        <time dateTime={eventDate.toISOString()} suppressHydrationWarning>
          {formatEventDateLine(eventDate, "short")}
        </time>
      </span>

      <EventLocationFact addressLine={event.addressLine} />

      <div className="flex items-center justify-between">
        <EventPriceFact price={event.price} />

        <Popover>
          <PopoverTrigger>
            <span className="text-primary border-primary/60 flex items-center gap-1 border-b border-dotted text-xs">
              discounts
              <InfoCircledIcon className="size-4" />
            </span>
          </PopoverTrigger>
          <PopoverContent>
            <p className="text-sm whitespace-pre-line">
              {event.discounts ?? "no discounts currently available"}
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <EventSeatsFact slots={event.slots} />
    </div>
  );
}

// stacked story + facts, used by the admin dinner preview
export function EventView({ event }: EventViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <EventFactList event={event} />
      <EventStory event={event} />
    </div>
  );
}
