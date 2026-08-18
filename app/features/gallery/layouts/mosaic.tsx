import { Link } from "react-router";

import type { GalleryImageModel } from "../view-models";

import type { GalleryLayoutProps } from "./types";

import { OptimizedImage } from "~/components/optimized-image";
import { Eyebrow } from "~/components/section";
import { formatEventMonthYear } from "~/features/events/date-format";
import { cn } from "~/lib/utils";
import type { ImageMetadata } from "~/models/image.server";

/**
 * Requested crop width for every tile. The intrinsic ratio decides the
 * height, so the crop never actually crops — it only pins a cache-friendly
 * URL size, and `srcSet` still covers the real rendered widths.
 */
const TILE_WIDTH = 640;

/** Rows uploaded before dimensions were stored fall back to a 3:2 frame. */
const FALLBACK_ASPECT = 3 / 2;

// The wall's rhythm comes from the photos, so the frame is derived from the
// stored dimensions rather than from a fixed grid cell.
function tileSize(image: ImageMetadata) {
  const aspect =
    image.width && image.height ? image.width / image.height : FALLBACK_ASPECT;

  return { width: TILE_WIDTH, height: Math.round(TILE_WIDTH / aspect) };
}

/**
 * Greedy masonry: every tile lands in the shortest column so far, ties to the
 * leftmost. All columns share one width, so a tile adds its frame's height
 * over its width; the gap between tiles is constant and stays out of the sum.
 */
function distribute(images: GalleryImageModel[], columnCount: number) {
  const columns: GalleryImageModel[][] = Array.from(
    { length: columnCount },
    () => [],
  );
  const heights = new Array<number>(columnCount).fill(0);

  for (const image of images) {
    let shortest = 0;
    for (let column = 1; column < columnCount; column += 1) {
      if (heights[column] < heights[shortest]) shortest = column;
    }

    const { width, height } = tileSize(image.image);
    columns[shortest].push(image);
    heights[shortest] += height / width;
  }

  return columns;
}

function DinnerLabel({
  event,
}: {
  event: NonNullable<GalleryImageModel["event"]>;
}) {
  const date = new Date(event.date);

  return (
    <Link
      to={`/dinners/${event.id}`}
      className="text-foreground/50 hover:text-foreground focus-visible:ring-ring w-fit transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
    >
      {event.title} ·{" "}
      <time dateTime={date.toISOString()} suppressHydrationWarning>
        {formatEventMonthYear(date)}
      </time>
    </Link>
  );
}

function MosaicTile({
  image,
  showDinner,
  sizes,
}: {
  image: GalleryImageModel;
  showDinner: boolean;
  sizes: string;
}) {
  const { width, height } = tileSize(image.image);
  const dinner = showDinner ? image.event : null;
  const hasCaption = Boolean(image.caption) || Boolean(dinner);

  return (
    <figure className="group relative">
      <OptimizedImage
        image={image.image}
        alt={image.alt}
        width={width}
        height={height}
        sizes={sizes}
        className="w-full rounded-2xl"
      />
      {hasCaption ? (
        // Below md the wall is photos only — the narrow tiles cannot hold
        // the caption text, so it reads in the full-size preview instead.
        // From md up it is a scrim over the whole tile: the scrim is the
        // hover target, so it covers the photo rather than a band of it.
        <figcaption
          tabIndex={0}
          className={cn(
            "text-foreground/80 focus-visible:ring-ring hidden flex-col gap-1 focus-visible:ring-2 focus-visible:outline-hidden",
            "md:from-background md:absolute md:inset-0 md:flex md:justify-end md:rounded-2xl md:bg-gradient-to-t md:to-transparent md:to-60% md:px-4 md:pt-12 md:pb-4 md:text-sm",
            "md:opacity-0 md:transition-opacity md:duration-200 md:group-focus-within:opacity-100 md:group-hover:opacity-100",
          )}
        >
          {image.caption ? (
            <span className="font-light">{image.caption}</span>
          ) : null}
          {dinner ? <DinnerLabel event={dinner} /> : null}
        </figcaption>
      ) : null}
    </figure>
  );
}

function MosaicWall({
  images,
  columnCount,
  gap,
  display,
  showDinner,
  sizes,
}: {
  images: GalleryImageModel[];
  columnCount: number;
  gap: string;
  display: string;
  showDinner: boolean;
  sizes: string;
}) {
  return (
    <div className={cn("items-start", gap, display)}>
      {distribute(images, columnCount).map((column, index) => (
        <div
          key={index}
          className={cn("flex w-full min-w-0 flex-1 flex-col", gap)}
        >
          {column.map((image) => (
            <MosaicTile
              key={image.id}
              image={image}
              showDinner={showDinner}
              sizes={sizes}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function MosaicGallery({
  images,
  variant = "page",
}: GalleryLayoutProps) {
  const isSection = variant === "section";

  if (images.length === 0) {
    // embedded in a dinner's page there is nothing worth saying — the story
    // column carries the page on its own
    if (isSection) return null;

    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed px-6 py-12 text-center md:py-16">
        <Eyebrow variant="tracked" tone="label">
          no photos yet
        </Eyebrow>
        <p className="text-foreground/65 max-w-xs text-sm font-light">
          nothing on the wall yet. the next dinner will hang the first ones.
        </p>
      </div>
    );
  }

  // The columns are dealt out here instead of by CSS multicol: WebKit
  // re-balances a multicol container whenever styles change inside it — the
  // tiles' fade-in on load is enough — and the second pass overfills the first
  // column, collapsing the wall.
  if (isSection) {
    return (
      <MosaicWall
        images={images}
        columnCount={2}
        gap="gap-2 md:gap-3"
        display="flex"
        showDinner={false}
        sizes="(min-width: 768px) 220px, 45vw"
      />
    );
  }

  // Two column counts mean two groupings, so the page hangs a wall for each and
  // shows one at a time. Both ask for the same URLs, so the browser still
  // fetches every photo once and the hidden wall is out of the a11y tree.
  return (
    <>
      <MosaicWall
        images={images}
        columnCount={2}
        gap="gap-3"
        display="flex md:hidden"
        showDinner
        sizes="(min-width: 768px) 300px, 45vw"
      />
      <MosaicWall
        images={images}
        columnCount={3}
        gap="gap-5"
        display="hidden md:flex"
        showDinner
        sizes="(min-width: 768px) 300px, 45vw"
      />
    </>
  );
}
