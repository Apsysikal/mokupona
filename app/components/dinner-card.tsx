import type { Event } from "@prisma/client";
import { Link } from "@remix-run/react";

export function DinnerCard({ event }: { event: Event }) {
  const parsedDate = new Date(Date.parse(event.date));

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
        {event.tags.length > 0 ? (
          <>
            <div>
              <div className="flex gap-1">
                {event.tags.split(" ").map((tag) => {
                  return (
                    <span className="rounded-full bg-emerald-200/50 px-2 py-1 text-xs uppercase text-emerald-800">
                      {tag}
                    </span>
                  );
                })}
              </div>
            </div>
          </>
        ) : null}
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
