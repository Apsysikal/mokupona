import {
  CalendarIcon,
  InfoCircledIcon,
  PersonIcon,
  SewingPinIcon,
} from "@radix-ui/react-icons";
import clsx from "clsx";
import { ReactNode } from "react";

import { AutoLink } from "./auto-link";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "./ui/accordion";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./ui/tooltip";

import { loader } from "~/routes/admin.dinners.$dinnerId";
import { dateFormatBuilder, getEventImageUrl } from "~/utils/misc";

export interface DinnerViewProps {
  event: Awaited<ReturnType<typeof loader>>["event"];
  preferredLocale?: string;
  topButton?: ReactNode;
}

export function DinnerView({
  event,
  preferredLocale = "de-CH",
  topButton,
}: DinnerViewProps) {
  const eventDate = new Date(event.date);
  const imageUrl = getEventImageUrl(event.imageId);
  const dateFormatter = dateFormatBuilder(preferredLocale);

  return (
    <div className="mx-auto flex max-w-4xl grow flex-col gap-5">
      <div className="flex flex-col gap-7">
        <img
          src={imageUrl}
          alt=""
          width={640}
          height={480}
          className="max-h-96 w-full rounded-xl object-cover shadow-xl"
        />

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl text-primary">{event.title}</h1>
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-md border p-2">
        <div className="font-small flex items-center gap-2">
          <CalendarIcon className="size-5" />

          <time dateTime={eventDate.toISOString()} suppressHydrationWarning>
            <p>{dateFormatter.format(event.date)}</p>
          </time>
        </div>

        <div className="flex items-center gap-2">
          <span className="not-sr-only">
            <SewingPinIcon className="size-5" />
          </span>

          <span className="sr-only">Location</span>

          <p>{`${event.address.zip} ${event.address.city}`}</p>
        </div>

        <div className="flex items-center gap-2">
          <CreditCardIcon />
          <p>{`${event.price} CHF`}</p>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <div className="flex items-center gap-2 text-sm">
                  <span className="underline">Discounts</span>
                  <InfoCircledIcon className="size-4" />
                </div>
              </TooltipTrigger>
              <TooltipContent className="whitespace-pre-line">
                <p>{event.discounts ?? "No discounts currently available"}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <div className="flex items-center gap-2">
          <PersonIcon className="size-5" />
          <span>{event.slots}</span>
        </div>
      </div>

      {topButton}

      <div>
        <div
          className={clsx([
            "whitespace-pre-line",
            // !expanded && "line-clamp-[20]",
          ])}
        >
          <p>{event.description}</p>

          {event.menuDescription || event.donationDescription ? (
            <Accordion
              type="single"
              collapsible
              className="mt-8 w-full space-y-4"
            >
              {event.menuDescription ? (
                <AccordionItem value="menu">
                  <AccordionTrigger className="font-bold text-primary">
                    Menu
                  </AccordionTrigger>
                  <AccordionContent>{event.menuDescription}</AccordionContent>
                </AccordionItem>
              ) : null}

              {event.donationDescription ? (
                <AccordionItem value="donation">
                  <AccordionTrigger className="font-bold text-primary">
                    Donation
                  </AccordionTrigger>
                  <AccordionContent>
                    <AutoLink text={event.donationDescription} />
                  </AccordionContent>
                </AccordionItem>
              ) : null}
            </Accordion>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function CreditCardIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="size-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z"
      />
    </svg>
  );
}
