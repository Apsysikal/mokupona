import type { Route } from "./+types/dinners._index";

import {
  Eyebrow,
  PageContainer,
  pageTitleClassName,
  SectionDivider,
} from "~/components/section";
import { Button } from "~/components/ui/button";
import { Card } from "~/components/ui/card";
import {
  FeaturedEventCard,
  PastEventCard,
} from "~/features/events/components/event-card";
import {
  orderEventsByStatus,
  partitionEvents,
} from "~/features/events/event-status";
import { toEventCardModel } from "~/features/events/view-models";
import { cn } from "~/lib/utils";
import { getEventsWithAddress } from "~/models/event.server";

export const loader = async () => {
  const events = await getEventsWithAddress();

  // the route ships the card model, not the Prisma entity
  return { events: events.map(toEventCardModel) };
};

export const meta: Route.MetaFunction = () => [{ title: "Dinners" }];

export default function DinnersIndexPage({ loaderData }: Route.ComponentProps) {
  const { events } = loaderData;

  const now = new Date();
  // events arrive sorted ascending, so the first upcoming one is the next
  const { upcoming: upcomingEvents, past } = partitionEvents(events, now);
  // the archive reads newest-first
  const pastEvents = orderEventsByStatus(past, now);

  return (
    <PageContainer className="grow pt-7 pb-20 md:pt-16">
      <div className="mb-9 flex flex-col gap-3 md:mb-12">
        <Eyebrow>gatherings</Eyebrow>
        <h1 className={pageTitleClassName}>dinners</h1>
        <p className="text-foreground/65 max-w-2xl text-base leading-relaxed font-light md:text-lg">
          {upcomingEvents.length > 0
            ? "a handful of seats open before each supper. reserve early, tables are small and fill quickly."
            : "we run a handful of intimate dinners a year. there's nothing on the calendar right now, but the next one is never far off."}
        </p>
      </div>

      {upcomingEvents.length > 0 ? (
        <>
          <SectionDivider className="mb-5">the next dinner</SectionDivider>
          <div className="mb-14 flex flex-col gap-8 md:mb-18">
            {upcomingEvents.map((event, index) => (
              <FeaturedEventCard
                key={event.id}
                event={event}
                isNext={index === 0}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState />
      )}

      {pastEvents.length > 0 ? (
        <>
          <SectionDivider className="mb-5">past dinners</SectionDivider>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5">
            {pastEvents.map((event) => (
              <PastEventCard key={event.id} event={event} />
            ))}
          </div>
        </>
      ) : null}
    </PageContainer>
  );
}

// between dinners the page stays warm rather than blank; deliberately no
// mailing-list capture here (design handoff §5)
function EmptyState() {
  return (
    <Card className="relative mb-14 flex flex-col items-center gap-4 overflow-hidden px-6 py-9 text-center md:mb-18 md:gap-5 md:px-14 md:py-19">
      <div
        aria-hidden
        className="glow-primary pointer-events-none absolute -top-36 left-1/2 h-80 w-md -translate-x-1/2"
      />
      <span className="text-primary relative text-sm font-semibold">
        nothing on the calendar right now
      </span>
      <h2 className={cn("relative max-w-lg", pageTitleClassName)}>
        the table is being set
      </h2>
      <p className="text-foreground/80 relative max-w-md text-sm leading-relaxed font-light md:text-lg">
        we&apos;re planning the next gathering. check back soon to see
        what&apos;s next, or follow along on instagram for the announcement.
      </p>
      <Button variant="outline" size="lg" className="relative mt-1" asChild>
        <a
          href="https://instagram.com/mokupona"
          target="_blank"
          rel="noopener noreferrer"
        >
          follow on instagram
        </a>
      </Button>
    </Card>
  );
}
