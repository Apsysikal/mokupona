import { PlusIcon, UtensilsIcon } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import type { Route } from "./+types/admin.dinners._index";

import { AdminDeleteButton } from "~/components/admin-delete-button";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminSearchField,
  FilterChip,
  SeatProgress,
} from "~/components/admin-ui";
import { CoverImage } from "~/components/cover-image";
import { buttonVariants } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import { formatAdminDateLine } from "~/features/events/date-format";
import {
  isPastEvent,
  orderEventsByStatus,
} from "~/features/events/event-status";
import { getAttendeeCountsForEvents } from "~/features/signup-form/read.server";
import { cn } from "~/lib/utils";
import { getEventsWithAddress } from "~/models/event.server";

export async function loader() {
  const events = await getEventsWithAddress();
  const seatCounts = await getAttendeeCountsForEvents(
    events.map((event) => event.id),
  );

  return {
    dinners: events.map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      image: event.image,
      slots: event.slots,
      location: `${event.address.streetName} ${event.address.houseNumber}`,
      signups: seatCounts[event.id] ?? 0,
    })),
  };
}

export const meta: Route.MetaFunction = () => {
  return [{ title: "Admin - Dinners" }];
};

const FILTERS = [
  { id: "all", label: "All" },
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
] as const;

type Filter = (typeof FILTERS)[number]["id"];

export default function AdminDinnersPage({ loaderData }: Route.ComponentProps) {
  const { dinners } = loaderData;
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const now = new Date();
  const q = query.trim().toLowerCase();

  const filtered = dinners
    .map((dinner) => ({
      ...dinner,
      past: isPastEvent(new Date(dinner.date), now),
    }))
    .filter((dinner) =>
      filter === "all" ? true : filter === "past" ? dinner.past : !dinner.past,
    )
    .filter(
      (dinner) =>
        !q ||
        dinner.title.toLowerCase().includes(q) ||
        dinner.location.toLowerCase().includes(q),
    );
  const visible = orderEventsByStatus(filtered, now);

  return (
    <div className="animate-page-in">
      <AdminPageHeader
        eyebrow={`${dinners.length} total`}
        title="Dinners"
        actions={
          <Link to="new" className={buttonVariants()}>
            <PlusIcon className="size-4" />
            New dinner
          </Link>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <AdminSearchField
          value={query}
          onChange={setQuery}
          placeholder="Search dinners"
        />
        <div className="flex gap-2">
          {FILTERS.map(({ id, label }) => (
            <FilterChip
              key={id}
              active={filter === id}
              onClick={() => setFilter(id)}
            >
              {label}
            </FilterChip>
          ))}
        </div>
      </div>

      {visible.length > 0 ? (
        <div className="flex flex-col gap-3">
          {visible.map((dinner) => (
            <DinnerCard key={dinner.id} dinner={dinner} />
          ))}
        </div>
      ) : (
        <AdminEmptyState
          icon={<UtensilsIcon className="size-6" />}
          title="No dinners match"
          description="Try a different search or filter — or create the next dinner for the season."
          action={
            <Link to="new" className={buttonVariants()}>
              New dinner
            </Link>
          }
        />
      )}
    </div>
  );
}

type Dinner = Awaited<ReturnType<typeof loader>>["dinners"][number] & {
  past: boolean;
};

function DinnerCard({ dinner }: { dinner: Dinner }) {
  const date = new Date(dinner.date);

  return (
    <Card
      interactive
      className={cn(
        "relative flex flex-wrap items-center gap-3 p-4",
        dinner.past && "opacity-60",
      )}
    >
      <CoverImage
        image={dinner.image}
        alt=""
        sizes="160px"
        className="w-40 shrink-0 rounded-lg border"
      />

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div>
          <p
            className={cn(
              "text-xs font-semibold tracking-wide",
              dinner.past ? "text-muted-foreground" : "text-accent-light",
            )}
          >
            <time dateTime={date.toISOString()} suppressHydrationWarning>
              {formatAdminDateLine(date)}
            </time>
          </p>
          <h2 className="mt-1 truncate text-base font-semibold">
            {/* stretched link: the pseudo-element makes the whole card the
                hit area while the accessible name stays the dinner title;
                the action row sits above it via `relative` */}
            <Link
              to={dinner.id}
              className="focus-visible:after:ring-ring after:absolute after:inset-0 focus-visible:after:ring-2 after:focus-visible:outline-hidden"
            >
              {dinner.title}
            </Link>
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {dinner.location}
          </p>
        </div>
        <div className="max-w-xs">
          <div className="mb-2 flex justify-between text-xs">
            <span className="text-foreground/80">{dinner.signups} signups</span>
            <span className="text-muted-foreground">
              {dinner.signups} / {dinner.slots}
            </span>
          </div>
          <SeatProgress
            taken={dinner.signups}
            total={dinner.slots}
            muted={dinner.past}
          />
        </div>
      </div>

      <div className="relative flex flex-wrap gap-2">
        <Link
          to={`${dinner.id}/signups`}
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Signups
        </Link>
        <Link
          to={`${dinner.id}/edit`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Edit
        </Link>
        <AdminDeleteButton action={`${dinner.id}/delete`} />
      </div>
    </Card>
  );
}
