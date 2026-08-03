import { Link } from "react-router";

import type { GalleryImageModel } from "../view-models";

import type { GalleryLayout, GalleryLayoutProps } from "./types";

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

function DinnerLabel({
  event,
}: {
  event: NonNullable<GalleryImageModel["event"]>;
}) {
  const date = new Date(event.date);

  return (
    <Link
      to={`/dinners/${event.id}`}
      className="text-foreground/50 hover:text-foreground w-fit transition-colors"
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
    <figure className="group relative mb-3 break-inside-avoid md:mb-5">
      <OptimizedImage
        image={image.image}
        alt={image.alt}
        width={width}
        height={height}
        sizes={sizes}
        className="w-full rounded-2xl"
      />
      {hasCaption ? (
        // One caption node, two presentations: static under the photo on
        // small screens (touch has no hover), a scrim over it from md up.
        // Never `hidden`, so the text is in the accessibility tree either way.
        <figcaption
          className={cn(
            "text-foreground/80 mt-2 flex flex-col gap-0.5 text-xs font-light",
            "md:from-background md:absolute md:inset-x-0 md:bottom-0 md:mt-0 md:rounded-b-2xl md:bg-gradient-to-t md:to-transparent md:px-4 md:pt-12 md:pb-4 md:text-sm",
            "md:opacity-0 md:transition-opacity md:duration-200 md:group-focus-within:opacity-100 md:group-hover:opacity-100",
          )}
        >
          {image.caption ? <span>{image.caption}</span> : null}
          {dinner ? <DinnerLabel event={dinner} /> : null}
        </figcaption>
      ) : null}
    </figure>
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
      <div className="rounded-2xl border border-dashed px-6 py-16 text-center">
        <Eyebrow variant="tracked" tone="label">
          from the table
        </Eyebrow>
        <p className="text-foreground/60 mt-3 text-sm font-light">
          no photos on the wall yet. the next dinner will hang the first ones.
        </p>
      </div>
    );
  }

  return (
    <div
      // CSS columns only: the wall lays itself out on the server, before a
      // single byte of JS arrives
      className={
        isSection
          ? "columns-2 gap-2 md:gap-3"
          : "columns-2 gap-3 md:columns-3 md:gap-5"
      }
    >
      {images.map((image) => (
        <MosaicTile
          key={image.id}
          image={image}
          showDinner={!isSection}
          sizes={
            isSection
              ? "(min-width: 768px) 220px, 45vw"
              : "(min-width: 768px) 300px, 45vw"
          }
        />
      ))}
    </div>
  );
}

export const layout: GalleryLayout = {
  id: "mosaic",
  label: "mosaic",
  description:
    "a masonry wall that keeps every photo's own shape — good for mixed portraits and panoramas, bad at reading in order.",
  Component: MosaicGallery,
};
