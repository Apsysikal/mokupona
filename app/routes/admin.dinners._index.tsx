import { PlusIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { Link, useFetcher } from "react-router";

import type { Route } from "./+types/admin.dinners._index";
import { OptimizedImage } from "./file.$fileId";

import {
  AdminEmptyState,
  AdminPageHeader,
  AdminSearchField,
  FilterChip,
  SeatProgress,
} from "~/components/admin-ui";
import { UtensilsIcon } from "~/components/icons";
import { Button } from "~/components/ui/button";
import { requireUserWithRole } from "~/features/auth/guards.server";
import { getAttendeeCountsForEvents } from "~/features/signup-form/read.server";
import { cn } from "~/lib/utils";
import { getEventsWithAddress } from "~/models/event.server";
import { formatAdminDateLine } from "~/utils/misc";

export async function loader({ request }: Route.LoaderArgs) {
  await requireUserWithRole(request, ["moderator", "admin"]);

  const events = await getEventsWithAddress();
  const seatCounts = await getAttendeeCountsForEvents(
    events.map((event) => event.id),
  );

  return {
    dinners: events.map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      imageId: event.imageId,
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

  const now = Date.now();
  const q = query.trim().toLowerCase();

  const visible = dinners
    .map((dinner) => ({
      ...dinner,
      past: new Date(dinner.date).getTime() < now,
    }))
    .filter((dinner) =>
      filter === "all" ? true : filter === "past" ? dinner.past : !dinner.past,
    )
    .filter(
      (dinner) =>
        !q ||
        dinner.title.toLowerCase().includes(q) ||
        dinner.location.toLowerCase().includes(q),
    )
    // no status badges — upcoming (soonest first) sort above past (newest first)
    .sort((a, b) => {
      if (a.past !== b.past) return a.past ? 1 : -1;
      const diff = new Date(a.date).getTime() - new Date(b.date).getTime();
      return a.past ? -diff : diff;
    });

  return (
    <div className="animate-page-in">
      <AdminPageHeader
        eyebrow={`${dinners.length} total`}
        title="Dinners"
        actions={
          <Button asChild>
            <Link to="new">
              <PlusIcon className="mr-2 size-4" />
              New dinner
            </Link>
          </Button>
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
            <Button asChild>
              <Link to="new">New dinner</Link>
            </Button>
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
  const deleteFetcher = useFetcher();
  const isDeleting = deleteFetcher.state !== "idle";
  const date = new Date(dinner.date);

  return (
    <div
      className={cn(
        "border-border bg-card hover:border-primary/30 flex flex-wrap items-center gap-4 rounded-2xl border p-4 transition-colors",
        dinner.past && "opacity-60",
      )}
    >
      <OptimizedImage
        imageId={dinner.imageId}
        alt=""
        width={208}
        height={172}
        className="border-border h-24 w-full rounded-lg border object-cover md:h-20 md:w-26"
      />

      <div className="flex min-w-0 flex-1 basis-56 flex-col gap-2">
        <div className="min-w-0">
          <p
            className={cn(
              "text-xs font-bold tracking-wide",
              dinner.past ? "text-foreground/50" : "text-accent-light",
            )}
          >
            <time dateTime={date.toISOString()} suppressHydrationWarning>
              {formatAdminDateLine(date)}
            </time>
          </p>
          <h2 className="mt-0.5 truncate text-base font-semibold">
            {dinner.title}
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            {dinner.location}
          </p>
        </div>
        <div className="max-w-xs">
          <div className="mb-1.5 flex justify-between text-xs">
            <span className="text-foreground/80">{dinner.signups} signups</span>
            <span className="text-foreground/50">
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

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="ghost" className="text-foreground/80" asChild>
          <Link to={`${dinner.id}/signups`}>Signups</Link>
        </Button>
        <Button size="sm" variant="outline" asChild>
          <Link to={`${dinner.id}/edit`}>Edit</Link>
        </Button>
        <deleteFetcher.Form method="POST" action={`${dinner.id}/delete`}>
          <Button
            type="submit"
            size="sm"
            variant="destructive-outline"
            disabled={isDeleting}
          >
            {isDeleting ? "Deleting…" : "Delete"}
          </Button>
        </deleteFetcher.Form>
      </div>
    </div>
  );
}
