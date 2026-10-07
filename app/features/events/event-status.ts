export function isPastEvent(date: Date, now: Date): boolean {
  return date.getTime() < now.getTime();
}

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
