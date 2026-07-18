import { PlusIcon } from "@radix-ui/react-icons";
import { Link } from "react-router";

import type { Route } from "./+types/admin._index";

import {
  AdminPageHeader,
  InitialsAvatar,
  SeatProgress,
} from "~/components/admin-ui";
import { OptimizedImage } from "~/components/optimized-image";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  formatAdminDateLine,
  formatAdminTimestamp,
} from "~/features/events/date-format";
import { EVENT_TIMEZONE } from "~/features/events/timezone";
import { getAttendeesForEvent } from "~/features/signup-form/read.server";
import { getEventById, getNextEvent } from "~/models/event.server";

export async function loader() {
  const next = await getNextEvent();
  const nextDinner = next ? await getEventById(next.id) : null;
  const attendees = nextDinner ? await getAttendeesForEvent(nextDinner.id) : [];

  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: EVENT_TIMEZONE,
  }).format(new Date());

  return {
    todayLabel,
    nextDinner: nextDinner
      ? {
          id: nextDinner.id,
          title: nextDinner.title,
          date: nextDinner.date,
          imageId: nextDinner.imageId,
          slots: nextDinner.slots,
          street: `${nextDinner.address.streetName} ${nextDinner.address.houseNumber}`,
          seatsTaken: attendees.length,
        }
      : null,
    // attendees arrive oldest-first; the card reads newest-first
    recentSignups: attendees
      .slice(-6)
      .reverse()
      .map(({ name, email, createdAt }) => ({ name, email, createdAt })),
  };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin" }];
};

export default function AdminOverviewPage({
  loaderData,
}: Route.ComponentProps) {
  const { todayLabel, nextDinner, recentSignups } = loaderData;

  return (
    <div className="animate-page-in">
      <AdminPageHeader
        eyebrow={todayLabel}
        title="Overview"
        subtitle="Here's what's coming up for moku pona."
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="locations/new">New location</Link>
            </Button>
            <Button asChild>
              <Link to="dinners/new">
                <PlusIcon className="mr-2 size-4" />
                New dinner
              </Link>
            </Button>
          </>
        }
      />

      <div className="flex flex-col gap-4">
        {nextDinner ? (
          <NextDinnerCard dinner={nextDinner} />
        ) : (
          <Card className="p-6 text-center">
            <p className="text-lg font-semibold">No upcoming dinner</p>
            <p className="text-foreground/50 mt-1 text-sm">
              Create the next dinner to see it here.
            </p>
          </Card>
        )}

        <Card className="p-4 md:p-5">
          <div className="mb-2 flex items-center justify-between md:mb-3">
            <h2 className="text-base font-semibold">Recent signups</h2>
            {nextDinner ? (
              <Link
                to={`dinners/${nextDinner.id}/signups`}
                prefetch="intent"
                className="text-foreground/50 hover:text-foreground text-sm transition-colors"
              >
                View all
              </Link>
            ) : null}
          </div>

          {recentSignups.length > 0 ? (
            <div className="grid grid-cols-1 gap-x-7 md:grid-cols-2">
              {recentSignups.map((signup, index) => (
                <div
                  key={`${signup.email}-${index}`}
                  className="border-border flex items-center gap-3 border-b py-3"
                >
                  <InitialsAvatar name={signup.name} seed={index} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {signup.name}
                    </p>
                    <p className="text-foreground/50 truncate text-sm">
                      {signup.email}
                    </p>
                  </div>
                  <time
                    dateTime={new Date(signup.createdAt).toISOString()}
                    suppressHydrationWarning
                    className="text-foreground/40 text-xs whitespace-nowrap"
                  >
                    {formatAdminTimestamp(new Date(signup.createdAt))}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-foreground/50 py-2 text-sm">No signups yet.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

type NextDinner = NonNullable<Awaited<ReturnType<typeof loader>>["nextDinner"]>;

function NextDinnerCard({ dinner }: { dinner: NextDinner }) {
  const date = new Date(dinner.date);

  return (
    <Card className="flex flex-wrap items-center gap-4 p-4">
      <OptimizedImage
        imageId={dinner.imageId}
        alt=""
        width={236}
        height={236}
        className="border-border h-32 w-full rounded-lg border object-cover md:size-28"
      />

      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-3">
        <div className="min-w-0">
          <p className="text-foreground/50 text-xs font-semibold tracking-widest uppercase">
            Next dinner
          </p>
          <h2 className="mt-1 truncate text-lg font-semibold">
            {dinner.title}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            <time dateTime={date.toISOString()} suppressHydrationWarning>
              {formatAdminDateLine(date)}
            </time>
            {" · "}
            {dinner.street}
          </p>
        </div>
        <div className="flex max-w-md items-center gap-3">
          <SeatProgress taken={dinner.seatsTaken} total={dinner.slots} />
          <span className="text-foreground/50 text-sm whitespace-nowrap">
            {dinner.seatsTaken} / {dinner.slots} seats
          </span>
        </div>
      </div>

      <div className="flex gap-2 max-md:w-full">
        <Button size="sm" className="max-md:flex-1" asChild>
          <Link to={`dinners/${dinner.id}/signups`}>View signups</Link>
        </Button>
        <Button size="sm" variant="outline" className="max-md:flex-1" asChild>
          <Link to={`dinners/${dinner.id}/edit`}>Edit</Link>
        </Button>
      </div>
    </Card>
  );
}
