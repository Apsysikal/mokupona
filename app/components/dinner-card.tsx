import { Link } from "@remix-run/react";
import type { Event } from "~/models/event.server";

function getKeysFromObject<T extends { [K in keyof T]: any }>(
  obj: T
): Array<keyof T> {
  return Object.keys(obj) as Array<keyof T>;
}

export function DinnerCard({
  id,
  event,
  preferredLocale,
}: {
  id: number;
  event: Event;
  preferredLocale: string;
}) {
  const parsedDate = new Date(event.date);

  const covers = event.cover?.data.attributes.formats || {};
  // Pick smallest size if available. Otherwise use the original,
  const availableCovers = getKeysFromObject(covers);

  const smallestCover =
    covers?.thumbnail ||
    covers?.medium ||
    covers?.medium ||
    covers?.large ||
    event.cover?.data.attributes;

  const srcSetStrings = [
    ...availableCovers.map((key) => {
      return `${covers[key]?.url} ${covers[key]?.width}w`;
    }),
    `${event.cover?.data.attributes.url} ${event.cover?.data.attributes.width}w`,
  ];

  //const slotsAvailable = event.slots - event.EventResponse.length;
  //const slotsFilled = event.slots - slotsAvailable;

  return (
    <div className="relative mx-auto overflow-hidden rounded-lg border border-gray-200 shadow-lg">
      <img
        src={smallestCover?.url}
        srcSet={srcSetStrings.join(",")}
        alt=""
        width={smallestCover?.width}
        height={smallestCover?.height}
        className="max-h-28 w-full object-cover"
      />
      <div className="flex flex-col gap-3 p-5">
        <div>
          <p className="font-semibold text-emerald-600">{event.subtitle}</p>
          <strong className="text-3xl text-gray-900">{event.title}</strong>
        </div>
        <div className="flex items-center justify-between">
          {event.tags?.length && event.tags.length > 0 && (
            <>
              <div>
                <div className="flex gap-1">
                  {event.tags?.split(" ").map((tag) => {
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

          {/* <div className="flex items-center gap-1 text-xs">
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
          </div> */}
        </div>
        <div>
          <time className="text-sm font-semibold text-emerald-600">
            {`${parsedDate.toLocaleDateString(
              preferredLocale
            )} - ${parsedDate.toLocaleTimeString(preferredLocale)}`}
          </time>
        </div>
        <div>
          <p className="text-gray-900">{event.summary}</p>
        </div>
        <div className="flex items-center justify-between">
          <Link
            to={`${id}`}
            className="rounded-md px-2 py-1 font-bold uppercase text-emerald-600 hover:bg-emerald-200/20"
          >
            Join
          </Link>
        </div>
      </div>
    </div>
  );
}
