import type { Route } from "./+types/dinners._index";

import { FeaturedDinnerCard, PastDinnerCard } from "~/components/dinner-card";
import { Eyebrow, SectionDivider } from "~/components/section";
import { Button } from "~/components/ui/button";
import { getEventsWithAddress } from "~/models/event.server";

export const loader = async () => {
  const events = await getEventsWithAddress();

  return { events };
};

export const meta: Route.MetaFunction = () => [{ title: "Dinners" }];

export default function DinnersIndexPage({ loaderData }: Route.ComponentProps) {
  const { events } = loaderData;

  const now = new Date();
  // events arrive sorted ascending, so the first upcoming one is the next
  const upcomingEvents = events.filter((event) => new Date(event.date) >= now);
  // the archive reads newest-first
  const pastEvents = events
    .filter((event) => new Date(event.date) < now)
    .reverse();

  return (
    <main className="mx-auto w-full max-w-[1040px] grow px-6 pt-7 pb-20 md:px-10 md:pt-16">
      <div className="mb-9 flex flex-col gap-3 md:mb-12 md:gap-3.5">
        <Eyebrow className="tracking-[.28em]">gatherings</Eyebrow>
        <h1 className="text-[34px] font-light tracking-[-.01em] md:text-[44px]">
          dinners
        </h1>
        <p className="text-fg-muted max-w-[560px] text-[15px] leading-relaxed font-light md:text-lg">
          {upcomingEvents.length > 0
            ? "a handful of seats open before each supper. reserve early, tables are small and fill quickly."
            : "we run a handful of intimate dinners a year. there's nothing on the calendar right now, but the next one is never far off."}
        </p>
      </div>

      {upcomingEvents.length > 0 ? (
        <>
          <SectionDivider className="mb-5.5">the next dinner</SectionDivider>
          <div className="mb-14 flex flex-col gap-8 md:mb-18">
            {upcomingEvents.map((event, index) => (
              <FeaturedDinnerCard
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
          <SectionDivider className="mb-5.5">past dinners</SectionDivider>
          <div className="grid grid-cols-2 gap-3.5 md:grid-cols-3 md:gap-5">
            {pastEvents.map((event) => (
              <PastDinnerCard key={event.id} event={event} />
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}

// between dinners the page stays warm rather than blank; deliberately no
// mailing-list capture here (design handoff §5)
function EmptyState() {
  return (
    <div className="border-foreground/12 bg-card relative mb-14 flex flex-col items-center gap-4 overflow-hidden rounded-2xl border px-6 py-9.5 text-center md:mb-18 md:gap-5.5 md:px-14 md:py-19">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-[150px] left-1/2 h-[320px] w-[460px] -translate-x-1/2 bg-[radial-gradient(circle,rgba(237,130,94,.16),transparent_70%)]"
      />
      <span className="text-primary relative text-[13px] font-semibold">
        nothing on the calendar right now
      </span>
      <h2 className="relative max-w-[520px] text-[28px] leading-[1.1] font-light md:text-[38px]">
        the table is being set
      </h2>
      <p className="text-fg-secondary relative max-w-[460px] text-sm leading-relaxed font-light md:text-[17px]">
        we&apos;re planning the next gathering. check back soon to see
        what&apos;s next, or follow along on instagram for the announcement.
      </p>
      <Button
        variant="outline"
        size="lg"
        className="relative mt-1.5 rounded-[9px]"
        asChild
      >
        <a
          href="https://instagram.com/mokupona"
          target="_blank"
          rel="noopener noreferrer"
        >
          follow on instagram
        </a>
      </Button>
    </div>
  );
}
