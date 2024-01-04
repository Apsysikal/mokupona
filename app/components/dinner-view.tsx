import type { Address, Event } from "@prisma/client";
import { SerializeFrom } from "@remix-run/node";

export interface DinnerViewProps {
  event:
    | (Event & { address: Address })
    | SerializeFrom<Event & { address: Address }>;
}

export function DinnerView({ event }: DinnerViewProps) {
  const eventDate = new Date(event.date);

  return (
    <div className="mx-auto flex max-w-2xl grow flex-col gap-5 text-gray-800">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold text-gray-900">{event.title}</h1>
      </div>

      <div className="flex flex-col gap-3">
        <img
          src={event.cover}
          alt=""
          width={1200}
          height={800}
          className="max-h-28 w-full rounded-xl object-cover shadow-xl"
        />

        <div>
          <div className="font-semibold text-emerald-600">
            <time dateTime={eventDate.toISOString()} suppressHydrationWarning>
              {`${eventDate.toLocaleDateString(
                "de-CH",
              )} - ${eventDate.toLocaleTimeString("de-CH")}`}
            </time>
          </div>
          <p>{`${event.address.streetName} ${event.address.houseNumber}`}</p>
          <p>{`${event.address.zip} ${event.address.city}`}</p>
        </div>
      </div>

      <div className="font-semibold text-emerald-600">
        <p>{`Cost, ${event.price} CHF (Non-Profit)`}</p>
      </div>

      <div>
        <p className="whitespace-pre-line">{event.description}</p>
      </div>
    </div>
  );
}
