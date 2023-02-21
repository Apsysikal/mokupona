import type { Event } from "@prisma/client";
import { Link } from "@remix-run/react";

export function DinnerCard({
  event,
}: {
  event: Event & {
    EventResponse: Array<{ id: string }>;
  };
}) {
  const parsedDate = new Date(event.date);
  const slotsAvailable = event.slots - event.EventResponse.length;
  const slotsFilled = event.slots - slotsAvailable;

  return (
    <div className="relative mx-auto overflow-hidden rounded-lg border border-gray-200 shadow-lg">
      <img
        src={event.imageUrl}
        alt=""
        width={1200}
        height={800}
        className="max-h-28 w-full object-cover"
      />
      <div className="flex flex-col gap-3 p-5">
        <div>
          <p className="font-semibold text-emerald-600">{event.subtitle}</p>
          <strong className="text-3xl text-gray-900">{event.title}</strong>
        </div>
        <div className="flex items-center justify-between">
          {event.tags.length > 0 && (
            <>
              <div>
                <div className="flex gap-1">
                  {event.tags.split(" ").map((tag) => {
                    return (
                      <span
                        key={tag}
                        className="rounded-full bg-emerald-200/50 px-2 py-1 text-xs uppercase text-emerald-800"
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div className="flex items-center gap-1 text-xs">
            {`${slotsFilled}/${event.slots}`}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="h-4 w-4"
            >
              <path
                fillRule="evenodd"
                d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z"
                clipRule="evenodd"
              />
            </svg>
          </div>
        </div>
        <div>
          <time className="text-sm font-semibold text-emerald-600">
            {`${parsedDate.toLocaleDateString()} - ${parsedDate.toLocaleTimeString()}`}
          </time>
        </div>
        <div>
          <p className="text-gray-900">{event.shortDescription}</p>
        </div>
        <div className="flex items-center justify-between">
          <Link
            to={event.id}
            className="rounded-md px-2 py-1 font-bold uppercase text-emerald-600 hover:bg-emerald-200/20"
          >
            Join
          </Link>
        </div>
      </div>
    </div>
  );
}
