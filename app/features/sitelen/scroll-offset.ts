/**
 * Where a scroll-linked row sits for a given scroll position.
 *
 * Each row repeats its glyphs, so it can slide forever: the offset wraps
 * within one copy's width. `direction` -1 slides left as the page scrolls
 * down, +1 slides right; scrolling back up runs it in reverse because the
 * offset is a pure function of the scroll position, not of time.
 *
 * Returns a translateX in px, always in [-copyWidth, 0), so the row's left
 * edge is never visible inside the band.
 */
export function rowOffset(
  scrollY: number,
  direction: -1 | 1,
  copyWidth: number,
  speed: number,
  phase = 0,
) {
  if (copyWidth <= 0) return 0;
  const travelled = direction * scrollY * speed + phase;
  const wrapped = ((travelled % copyWidth) + copyWidth) % copyWidth;
  return wrapped - copyWidth;
}
