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
    <div className="flex flex-col gap-5 md:gap-6.5">
      <OptimizedImage
        imageId={event.imageId}
        alt=""
        width={640}
        height={480}
        className="h-[250px] w-full rounded-2xl object-cover md:h-[400px]"
      />

      <div className="flex flex-col gap-3 md:gap-3.5">
        <span className="text-primary flex items-center gap-2 text-xs font-semibold md:text-[13px]">
          <CalendarIcon className="size-[15px]" />
          <time dateTime={eventDate.toISOString()} suppressHydrationWarning>
            {formatEventDateLine(eventDate, "long")}
          </time>
        </span>
        <h1 className="text-[30px] leading-[1.08] font-light lowercase md:text-[42px]">
          {event.title}
        </h1>
      </div>

      <p className="text-fg-secondary text-[15px] leading-[1.8] font-light whitespace-pre-line md:text-[17px]">
        <AutoLink text={event.description} />
      </p>

      {menuLines?.length || event.donationDescription ? (
        <Accordion
          type="single"
          collapsible
          defaultValue="menu"
          className="border-foreground/12 mt-2 w-full border-t"
        >
          {menuLines?.length ? (
            <AccordionItem value="menu" className="border-foreground/12">
              <AccordionTrigger className="text-primary">
                menu
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <div className="flex flex-col gap-3.5">
                  {menuLines.map((line, index) => (
                    <div
                      key={index}
                      className="text-fg-secondary flex gap-3.5 text-[15px] leading-relaxed font-light"
                    >
                      <span className="text-fg-faint pt-0.5 font-mono text-[13px]">
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
            <AccordionItem value="donation" className="border-foreground/12">
              <AccordionTrigger className="text-primary">
                donation
              </AccordionTrigger>
              <AccordionContent className="pb-6">
                <p className="text-fg-secondary text-[15px] leading-relaxed font-light whitespace-pre-line">
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
    <div className="text-fg-secondary flex flex-col gap-3 text-sm">
      <div className="flex items-center gap-2.5">
        <CalendarIcon className="text-fg-label size-4" />
        <time dateTime={eventDate.toISOString()} suppressHydrationWarning>
          {formatEventDateLine(eventDate, "short")}
        </time>
      </div>

      <div className="flex items-center gap-2.5">
        <SewingPinIcon className="text-fg-label size-4" />
        <span className="sr-only">location</span>
        <span className="lowercase">{`${event.address.zip} ${event.address.city}`}</span>
      </div>

      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <CreditCardIcon className="text-fg-label size-4" />
          <span className="sr-only">price</span>
          {event.price} chf
        </span>

        <Popover>
          <PopoverTrigger>
            <span className="text-primary border-primary/60 flex items-center gap-1 border-b border-dotted text-xs">
              discounts
              <InfoCircledIcon className="size-3.5" />
            </span>
          </PopoverTrigger>
          <PopoverContent>
            <p className="text-sm whitespace-pre-line">
              {event.discounts ?? "no discounts currently available"}
            </p>
          </PopoverContent>
        </Popover>
      </div>

      <div className="flex items-center gap-2.5">
        <PersonIcon className="text-fg-label size-4" />
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
