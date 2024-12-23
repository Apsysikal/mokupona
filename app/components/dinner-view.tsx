import type { Address, Event } from "@prisma/client";
import { SerializeFrom } from "@remix-run/node";

import { AutoLink } from "./auto-link";

import { getEventImageUrl } from "~/utils/misc";

export interface DinnerViewProps {
  event:
    | (Event & { address: Address })
    | SerializeFrom<Event & { address: Address }>;
}

export function DinnerView({ event }: DinnerViewProps) {
  const eventDate = new Date(event.date);
  const imageUrl = getEventImageUrl(event.imageId);

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

        <div className="font-small">
          <time dateTime={eventDate.toISOString()} suppressHydrationWarning>
            {`${eventDate.toLocaleDateString("de-CH", {
              dateStyle: "medium",
            })} - ${eventDate.toLocaleTimeString("de-CH", { timeStyle: "short" })}`}
          </time>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-3xl text-primary">{event.title}</h1>
        </div>

        {/* <div>
          <p>{`${event.address.streetName} ${event.address.houseNumber}`}</p>
          <p>{`${event.address.zip} ${event.address.city}`}</p>
        </div> */}
      </div>

      {/* <div className="font-semibold text-primary">
        <p>{`Cost, ${event.price} CHF (Non-Profit)`}</p>
      </div> */}

      <div>
        <p className="whitespace-pre-line">
          <AutoLink text={event.description} />
        </p>
      </div>
    </div>
  );
}
