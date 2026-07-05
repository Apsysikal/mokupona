import { PlusIcon } from "@radix-ui/react-icons";
import { Link } from "react-router";

import type { Route } from "./+types/admin._index";
import { OptimizedImage } from "./file.$fileId";

import {
  AdminPageHeader,
  InitialsAvatar,
  SeatProgress,
} from "~/components/admin-ui";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { getAttendeesForEvent } from "~/features/signup-form/read.server";
import { getEventById, getNextEvent } from "~/models/event.server";
import { formatAdminDateLine, formatAdminTimestamp } from "~/utils/misc";
import { requireUserWithRole } from "~/utils/session.server";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const next = await getNextEvent();
  const nextDinner = next ? await getEventById(next.id) : null;
  const attendees = nextDinner ? await getAttendeesForEvent(nextDinner.id) : [];

  const todayLabel = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Zurich",
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
    <div className="animate-in fade-in slide-in-from-bottom-1.5 duration-300">
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
                <PlusIcon className="mr-2 size-[17px]" />
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
          <Card className="rounded-[14px] p-6 text-center">
            <p className="text-[17px] font-bold">No upcoming dinner</p>
            <p className="text-fg-label mt-1.5 text-sm">
              Create the next dinner to see it here.
            </p>
          </Card>
        )}

        <Card className="rounded-[14px] p-4.5 md:p-5.5">
          <div className="mb-2 flex items-center justify-between md:mb-3">
            <h2 className="text-base font-bold tracking-[-.01em]">
              Recent signups
            </h2>
            {nextDinner ? (
              <Link
                to={`dinners/${nextDinner.id}/signups`}
                prefetch="intent"
                className="text-fg-label hover:text-foreground text-[13px] transition-colors"
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
                  className="border-foreground/10 flex items-center gap-3 border-b py-2.75"
                >
                  <InitialsAvatar name={signup.name} seed={index} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {signup.name}
                    </p>
                    <p className="text-fg-label truncate text-[12.5px]">
                      {signup.email}
                    </p>
                  </div>
                  <time
                    dateTime={new Date(signup.createdAt).toISOString()}
                    suppressHydrationWarning
                    className="text-fg-faint text-xs whitespace-nowrap"
                  >
                    {formatAdminTimestamp(new Date(signup.createdAt))}
                  </time>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-fg-label py-2 text-sm">No signups yet.</p>
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
    <Card className="flex flex-wrap items-center gap-4.5 rounded-[14px] p-4.5">
      <OptimizedImage
        imageId={dinner.imageId}
        alt=""
        width={236}
        height={236}
        className="border-foreground/10 h-[132px] w-full rounded-[10px] border object-cover md:size-[118px]"
      />

      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-3">
        <div className="min-w-0">
          <p className="text-fg-label text-xs font-semibold tracking-[.06em] uppercase">
            Next dinner
          </p>
          <h2 className="mt-1 truncate text-[19px] font-bold tracking-[-.01em]">
            {dinner.title}
          </h2>
          <p className="text-muted-foreground mt-1 text-[13.5px]">
            <time dateTime={date.toISOString()} suppressHydrationWarning>
              {formatAdminDateLine(date)}
            </time>
            {" · "}
            {dinner.street}
          </p>
        </div>
        <div className="flex max-w-[420px] items-center gap-3.5">
          <SeatProgress taken={dinner.seatsTaken} total={dinner.slots} />
          <span className="text-fg-label text-[12.5px] whitespace-nowrap">
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
