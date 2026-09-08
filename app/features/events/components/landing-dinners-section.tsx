import type { EventCardModel } from "../view-models";

import { FeaturedEventCard, PastEventCard } from "./event-card";

import {
  PageContainer,
  SecondaryCTA,
  SectionDivider,
} from "~/components/section";

type LandingDinnersSectionProps = {
  upcoming: EventCardModel[];
  /** Every past dinner, ordered by the route — rendered as-is. */
  past: EventCardModel[];
};

/**
 * The dinners the landing page shows once you scroll past the title card:
 * the single next gathering, then everything that has already been eaten.
 * The featured card drops its facts row here — price, seats and location are
 * for deciding, and the decision happens on the dinner's own page.
 */
export function LandingDinnersSection({
  upcoming,
  past,
}: LandingDinnersSectionProps) {
  const nextDinner = upcoming.at(0);

  return (
    <PageContainer as="section" className="pt-14 pb-20 md:pt-20 md:pb-28">
      {nextDinner ? (
        <>
          <SectionDivider className="mb-5" handwritten="nextDinner">
            the next dinner
          </SectionDivider>
          <div className="mb-14 md:mb-20">
            <FeaturedEventCard event={nextDinner} showFacts={false} />
          </div>
        </>
      ) : (
        <>
          <SectionDivider className="mb-5" handwritten="nextDinner">
            the next dinner
          </SectionDivider>
          <p className="text-muted-foreground mb-14 max-w-md text-base font-light md:mb-20 md:text-lg">
            nothing on the calendar right now — we&apos;re planning the next
            gathering. the table is never empty for long.
          </p>
        </>
      )}

      {past.length > 0 ? (
        <>
          <SectionDivider className="mb-5" handwritten="pastDinners">
            past dinners
          </SectionDivider>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
            {past.map((event) => (
              <PastEventCard key={event.id} event={event} />
            ))}
          </div>
        </>
      ) : null}

      {past.length > 0 || nextDinner ? (
        <div className="mt-10 flex justify-center md:mt-14">
          <SecondaryCTA to="/dinners">see all dinners →</SecondaryCTA>
        </div>
      ) : null}
    </PageContainer>
  );
}
