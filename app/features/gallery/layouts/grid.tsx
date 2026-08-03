import { ChevronLeftIcon, ChevronRightIcon } from "@radix-ui/react-icons";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router";

import type { GalleryImageModel } from "../view-models";

import type { GalleryLayout, GalleryLayoutProps } from "./types";

import { OptimizedImage } from "~/components/optimized-image";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { formatEventMonthYear } from "~/features/events/date-format";
import { cn } from "~/lib/utils";

/** Square crop requested per tile — one size covers every column count. */
const TILE_EDGE = 600;

/** Longest edge asked of the provider in the lightbox; the srcset tops out at 1080w anyway. */
const LIGHTBOX_MAX_EDGE = 1200;

/**
 * How many tiles the embedded variant shows before it folds the rest behind
 * "+N more" — two or three rows sit beside a story column without becoming
 * the page.
 */
const SECTION_TILE_CAP = 6;

/**
 * The lightbox must not crop, so it asks for the image's own ratio, scaled
 * down to something a CDN rung can actually serve.
 */
function lightboxSize(image: GalleryImageModel) {
  // 4:3 stands in for rows that never recorded their dimensions
  const width = image.image.width ?? 4;
  const height = image.image.height ?? 3;
  const scale = Math.min(1, LIGHTBOX_MAX_EDGE / Math.max(width, height));

  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

function eventLine(event: NonNullable<GalleryImageModel["event"]>) {
  return `${event.title} · ${formatEventMonthYear(new Date(event.date))}`;
}

export function GalleryGrid({ images, variant = "page" }: GalleryLayoutProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  // the tile that opened the lightbox, so focus lands back where it left
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const isSection = variant === "section";
  const total = images.length;
  // an index can outlive the list it pointed into (an admin removes an entry
  // while the lightbox is open) — read that as closed, not as a blank frame
  const active =
    activeIndex !== null && activeIndex < total ? images[activeIndex] : null;
  const open = active !== null;

  // arrows are bound to the window rather than the dialog content: radix moves
  // focus around inside the lightbox (close button, prev/next), and the keys
  // have to keep working wherever it lands
  useEffect(() => {
    if (!open || total === 0) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const step =
        event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (step === 0) return;

      event.preventDefault();
      setActiveIndex((current) =>
        current === null ? current : (current + step + total) % total,
      );
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, total]);

  // the lightbox content unmounts with the dialog, so radix's own focus
  // restoration never runs — put the caret back on the tile by hand
  useEffect(() => {
    if (open) return;

    const trigger = triggerRef.current;
    triggerRef.current = null;
    trigger?.focus();
  }, [open]);

  if (total === 0) {
    // embedded, the gallery is one section among many — an empty one is noise
    if (isSection) return null;

    return (
      <p className="text-foreground/65 rounded-2xl border px-6 py-16 text-center text-sm font-light">
        no photos from the table yet. they turn up a week or so after each
        dinner.
      </p>
    );
  }

  const visible = isSection ? images.slice(0, SECTION_TILE_CAP) : images;
  const hiddenCount = total - visible.length;

  return (
    <>
      <ul
        className={cn(
          "grid grid-cols-2 gap-2",
          isSection
            ? "sm:grid-cols-3"
            : "sm:grid-cols-3 md:gap-3 lg:grid-cols-4",
        )}
      >
        {visible.map((image, index) => {
          const isOverflowTile =
            hiddenCount > 0 && index === visible.length - 1;

          return (
            <li key={image.id}>
              <button
                type="button"
                onClick={(event) => {
                  triggerRef.current = event.currentTarget;
                  setActiveIndex(index);
                }}
                className="group focus-visible:ring-ring relative block w-full cursor-pointer overflow-hidden rounded-2xl focus-visible:ring-2 focus-visible:outline-hidden"
              >
                <OptimizedImage
                  image={image.image}
                  alt={image.alt}
                  width={TILE_EDGE}
                  height={TILE_EDGE}
                  sizes={
                    isSection
                      ? "(min-width: 768px) 180px, 45vw"
                      : "(min-width: 1024px) 240px, (min-width: 640px) 30vw, 45vw"
                  }
                  className="w-full transition-opacity duration-300 group-hover:opacity-80"
                />

                {isOverflowTile ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-[rgb(10_8_6/0.6)] text-sm font-semibold">
                    +{hiddenCount} more
                  </span>
                ) : null}

                {!isSection && image.event ? (
                  // the dinner stays out of the way until you reach for it, so
                  // the grid still reads as one even field
                  <span className="absolute inset-x-0 bottom-0 truncate bg-linear-to-t from-[rgb(10_8_6/0.85)] to-transparent px-3 pt-8 pb-2 text-left text-xs opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    {eventLine(image.event)}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!next) setActiveIndex(null);
        }}
      >
        {active && activeIndex !== null ? (
          // pt leaves the built-in close button a strip of its own rather than
          // floating it over the photo
          <DialogContent className="max-w-3xl gap-4 p-4 pt-13 sm:p-5 sm:pt-13">
            <OptimizedImage
              key={active.id}
              image={active.image}
              alt={active.alt}
              {...lightboxSize(active)}
              fit="contain"
              sizes="(min-width: 768px) 720px, 92vw"
              className="mx-auto max-h-[70vh] w-auto rounded-xl"
            />

            <div className="flex items-end justify-between gap-5">
              <div aria-live="polite" className="flex min-w-0 flex-col gap-1">
                {/* the position doubles as the dialog's accessible name, so a
                    reader hears where it landed and where arrowing moved it */}
                <DialogTitle className="text-foreground/50 text-xs font-normal">
                  {activeIndex + 1} of {total}
                </DialogTitle>
                {active.caption ? (
                  <p className="text-foreground/80 text-sm font-light">
                    {active.caption}
                  </p>
                ) : null}
                {!isSection && active.event ? (
                  <Link
                    to={`/dinners/${active.event.id}`}
                    className="text-foreground/50 hover:text-foreground truncate text-xs transition-colors"
                  >
                    {eventLine(active.event)}
                  </Link>
                ) : null}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <LightboxStepButton
                  label="previous image"
                  onClick={() =>
                    setActiveIndex((activeIndex + total - 1) % total)
                  }
                >
                  <ChevronLeftIcon className="size-5" />
                </LightboxStepButton>
                <LightboxStepButton
                  label="next image"
                  onClick={() => setActiveIndex((activeIndex + 1) % total)}
                >
                  <ChevronRightIcon className="size-5" />
                </LightboxStepButton>
              </div>
            </div>
          </DialogContent>
        ) : null}
      </Dialog>
    </>
  );
}

function LightboxStepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="text-foreground/50 hover:text-foreground focus-visible:ring-ring cursor-pointer rounded-lg p-2 transition-colors focus-visible:ring-2 focus-visible:outline-hidden"
    >
      {children}
    </button>
  );
}

export const layout: GalleryLayout = {
  id: "grid",
  label: "grid",
  description:
    "an even field of square thumbnails with a lightbox — calm and easy to scan, but every photo gets cropped to the same shape.",
  Component: GalleryGrid,
};
