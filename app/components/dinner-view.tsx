import {
  CalendarIcon,
  InfoCircledIcon,
  PersonIcon,
  SewingPinIcon,
} from "@radix-ui/react-icons";

import { AutoLink } from "./auto-link";
import { CreditCardIcon } from "./icons";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";

import type { loader } from "~/routes/admin.dinners.$dinnerId";
import { OptimizedImage } from "~/routes/file.$fileId";
import { formatEventDateLine } from "~/utils/misc";

type EventWithAddress = Awaited<ReturnType<typeof loader>>["event"];

export interface DinnerViewProps {
  event: EventWithAddress;
}

// the editorial left column of the dinner detail page: photo, date, title,
// story, and the menu/donation accordions (design handoff §3)
export function DinnerStory({ event }: DinnerViewProps) {
  const eventDate = new Date(event.date);

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
        <span className="text-primary flex items-center gap-2 text-sm font-semibold">
          <CalendarIcon className="size-4" />
          <time dateTime={eventDate.toISOString()} suppressHydrationWarning>
            {formatEventDateLine(eventDate, "long")}
          </time>
        </span>
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
              <AccordionTrigger className="text-primary">
                menu
              </AccordionTrigger>
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
export function DinnerFactList({ event }: DinnerViewProps) {
  const eventDate = new Date(event.date);

  return (
    <div className="text-foreground/80 flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-2">
        <CalendarIcon className="text-foreground/50 size-4" />
        <time dateTime={eventDate.toISOString()} suppressHydrationWarning>
          {formatEventDateLine(eventDate, "short")}
        </time>
      </div>

      <div className="flex items-center gap-2">
        <SewingPinIcon className="text-foreground/50 size-4" />
        <span className="sr-only">location</span>
        <span>{`${event.address.zip} ${event.address.city}`}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2">
          <CreditCardIcon className="text-foreground/50 size-4" />
          <span className="sr-only">price</span>
          {event.price} chf
        </span>

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

      <div className="flex items-center gap-2">
        <PersonIcon className="text-foreground/50 size-4" />
        <span>{event.slots} seats</span>
      </div>
    </div>
  );
}

// stacked story + facts, used by the admin dinner preview
export function DinnerView({ event }: DinnerViewProps) {
  return (
    <div className="flex flex-col gap-6">
      <DinnerFactList event={event} />
      <DinnerStory event={event} />
    </div>
  );
}
