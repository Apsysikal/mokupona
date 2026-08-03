import { Link } from "react-router";

import type { GalleryGroup, GalleryImageModel } from "../view-models";
import { groupGalleryImagesByEvent } from "../view-models";

import type {
  GalleryLayout,
  GalleryLayoutProps,
  GalleryLayoutVariant,
} from "./types";

import { OptimizedImage } from "~/components/optimized-image";
import { Eyebrow } from "~/components/section";
import { formatEventMonthYear } from "~/features/events/date-format";
import { cn } from "~/lib/utils";

// The lead photo of a chapter is cropped wide (the evening's establishing
// shot); the ones that follow stay small so the lead keeps the eye.
const HERO_CROP = { width: 1440, height: 810 };
const RUN_CROP = { width: 640, height: 480 };

const HERO_SIZES: Record<GalleryLayoutVariant, string> = {
  page: "(min-width: 1024px) 944px, 100vw",
  section: "(min-width: 768px) 620px, 100vw",
};

// below md the run is a fixed-width scrolling strip (w-60), above it a grid
const RUN_SIZES: Record<GalleryLayoutVariant, string> = {
  page: "(min-width: 768px) 300px, 240px",
  section: "(min-width: 768px) 220px, 240px",
};

function photoCount(count: number) {
  return `${count} ${count === 1 ? "photo" : "photos"}`;
}

function GalleryFigure({
  image,
  width,
  height,
  sizes,
  className,
  imageClassName,
}: {
  image: GalleryImageModel;
  width: number;
  height: number;
  sizes: string;
  className?: string;
  imageClassName?: string;
}) {
  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <OptimizedImage
        image={image.image}
        alt={image.alt}
        width={width}
        height={height}
        sizes={sizes}
        className={cn("w-full rounded-2xl", imageClassName)}
      />
      {image.caption ? (
        <figcaption className="text-foreground/50 text-xs font-light">
          {image.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

function ChapterRun({
  images,
  variant,
  label,
}: {
  images: GalleryImageModel[];
  variant: GalleryLayoutVariant;
  label: string;
}) {
  const [hero, ...rest] = images;
  if (!hero) return null;

  return (
    <div className="flex min-w-0 flex-col gap-3 md:gap-5">
      <GalleryFigure
        image={hero}
        {...HERO_CROP}
        sizes={HERO_SIZES[variant]}
        imageClassName="max-h-[70vh]"
      />

      {rest.length > 0 ? (
        <div
          // On a phone these photos are swiped through, not scanned, so the
          // tail becomes a snapping strip. Nothing inside it is focusable
          // (no lightbox, no links), so the scroller itself has to be a tab
          // stop or keyboard-only visitors can never reach the far end.
          tabIndex={0}
          role="group"
          aria-label={label}
          className={cn(
            "scrollbar-hidden focus-visible:inset-ring-ring flex snap-x snap-mandatory gap-3 overflow-x-auto rounded-2xl focus-visible:inset-ring-2 focus-visible:outline-hidden md:grid md:snap-none md:gap-5 md:overflow-x-visible",
            variant === "section" ? "md:grid-cols-2" : "md:grid-cols-3",
          )}
        >
          {rest.map((image) => (
            <GalleryFigure
              key={image.id}
              image={image}
              {...RUN_CROP}
              sizes={RUN_SIZES[variant]}
              className="w-60 shrink-0 snap-start md:w-auto md:shrink"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ChapterHeading({
  group,
  headingId,
}: {
  group: GalleryGroup;
  headingId: string;
}) {
  const { event, images } = group;
  const count = (
    <span className="text-foreground/40 text-xs">
      {photoCount(images.length)}
    </span>
  );

  if (!event) {
    return (
      <header className="flex flex-col gap-1">
        <Eyebrow variant="tracked" tone="label">
          no dinner attached
        </Eyebrow>
        <div className="flex flex-wrap items-baseline gap-3">
          <h2
            id={headingId}
            className="text-xl leading-tight font-light tracking-tight md:text-2xl"
          >
            odds and ends
          </h2>
          {count}
        </div>
      </header>
    );
  }

  const date = new Date(event.date);

  return (
    <header className="flex flex-col gap-1">
      <Eyebrow variant="tracked" tone="label">
        <time dateTime={date.toISOString()} suppressHydrationWarning>
          {formatEventMonthYear(date)}
        </time>
      </Eyebrow>
      <div className="flex flex-wrap items-baseline gap-3">
        <h2
          id={headingId}
          className="text-xl leading-tight font-light tracking-tight md:text-2xl"
        >
          <Link
            to={`/dinners/${event.id}`}
            prefetch="intent"
            className="hover:text-accent-light transition-colors"
          >
            {event.title}
          </Link>
        </h2>
        {count}
      </div>
    </header>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      <Eyebrow variant="tracked" tone="label">
        from the table
      </Eyebrow>
      <p className="text-foreground/80 max-w-md text-base font-light">
        no photos yet. the next evening will start the story.
      </p>
    </div>
  );
}

export function StreamGallery({
  images,
  variant = "page",
}: GalleryLayoutProps) {
  if (images.length === 0) {
    // embedded, an empty gallery should leave no trace on the dinner's page
    return variant === "section" ? null : <EmptyState />;
  }

  if (variant === "section") {
    // one dinner's page already says which dinner this is — a chapter
    // heading here would only repeat the <h1> above it
    return (
      <ChapterRun
        images={images}
        variant="section"
        label="more photos from this dinner"
      />
    );
  }

  const groups = groupGalleryImagesByEvent(images);

  return (
    <div className="flex flex-col gap-14 md:gap-20">
      {groups.map((group) => {
        const headingId = `stream-chapter-${group.event?.id ?? "unclaimed"}`;

        return (
          <section
            key={headingId}
            aria-labelledby={headingId}
            className="flex min-w-0 flex-col gap-4 md:gap-5"
          >
            <ChapterHeading group={group} headingId={headingId} />
            <ChapterRun
              images={group.images}
              variant="page"
              label={
                group.event
                  ? `more photos from ${group.event.title}`
                  : "more photos with no dinner attached"
              }
            />
          </section>
        );
      })}
    </div>
  );
}

export const layout: GalleryLayout = {
  id: "stream",
  label: "stream",
  description:
    "reads the gallery as an archive of evenings — strongest when the dinner behind a photo matters, weakest when you just want to scan every photo at once.",
  Component: StreamGallery,
};
