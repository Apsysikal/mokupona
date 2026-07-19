// Client-safe: routes evaluate the past/upcoming rule during browser renders.

/**
 * The single owner of the past/upcoming rule: an event on `now` exactly is
 * upcoming. The DB-side twin lives in app/models/event.server.ts#getNextEvent
 * (`date: { gte: now }`), which cannot import this module.
 */
export function isPastEvent(date: Date, now: Date): boolean {
  return date.getTime() < now.getTime();
}

/**
 * Split events into upcoming and past against a single `now`, preserving the
 * input order within each half. Accepts `Date` or serialized (string) dates.
 */
export function partitionEvents<T extends { date: Date | string }>(
  events: T[],
  now: Date,
): { upcoming: T[]; past: T[] } {
  const upcoming: T[] = [];
  const past: T[] = [];

  for (const event of events) {
    if (isPastEvent(new Date(event.date), now)) {
      past.push(event);
    } else {
      upcoming.push(event);
    }
  }

  return { upcoming, past };
}

/** Return a new array: upcoming soonest-first, then past newest-first. */
export function orderEventsByStatus<T extends { date: Date | string }>(
  events: readonly T[],
  now: Date,
): T[] {
  return [...events].sort((a, b) => {
    const aDate = new Date(a.date);
    const bDate = new Date(b.date);
    const aPast = isPastEvent(aDate, now);
    const bPast = isPastEvent(bDate, now);

    if (aPast !== bPast) return aPast ? 1 : -1;

    const difference = aDate.getTime() - bDate.getTime();
    return aPast ? -difference : difference;
  });
}
