import { Link } from "react-router";

import {
  GALLERY_LAYOUTS,
  getGalleryLayout,
} from "../layouts";
import type { GalleryImageModel } from "../view-models";

import { SectionDivider } from "~/components/section";
import { GALLERY_FOUNDATION_IDS } from "~/features/gallery/foundations/types";
import { cn } from "~/lib/utils";

/**
 * The gallery as it appears on a past dinner's page. Renders nothing at all
 * when that dinner has no images — an empty state here would be noise on a
 * page that is about the evening, not about its photos.
 */
export function EventGallerySection({
  images,
  foundationId,
  layoutId,
}: {
  images: GalleryImageModel[];
  foundationId: string;
  layoutId: string;
}) {
  const layout = getGalleryLayout(layoutId);
  if (!layout || images.length === 0) return null;

  const { Component } = layout;

  return (
    <section className="mt-14 flex flex-col gap-5">
      <SectionDivider>from that evening</SectionDivider>

      <Component images={images} variant="section" />

      <GalleryPrototypeHint
        foundationId={foundationId}
        layoutId={layoutId}
      />
    </section>
  );
}

// Prototype scaffolding: swaps the data model / layout in place via search
// params so all nine pairs can be compared from the page they matter on.
// Goes out with the losing prototypes.
function GalleryPrototypeHint({
  foundationId,
  layoutId,
}: {
  foundationId: string;
  layoutId: string;
}) {
  return (
    <div className="text-foreground/50 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      <span>prototype:</span>
      {GALLERY_FOUNDATION_IDS.map((id) => (
        <Link
          key={id}
          to={`?gallery=${id}&layout=${layoutId}`}
          preventScrollReset
          className={cn(
            "hover:text-foreground transition-colors",
            id === foundationId && "text-primary",
          )}
        >
          {id}
        </Link>
      ))}
      <span aria-hidden className="bg-border h-3 w-px" />
      {GALLERY_LAYOUTS.map((layout) => (
        <Link
          key={layout.id}
          to={`?gallery=${foundationId}&layout=${layout.id}`}
          preventScrollReset
          className={cn(
            "hover:text-foreground transition-colors",
            layout.id === layoutId && "text-primary",
          )}
        >
          {layout.label}
        </Link>
      ))}
    </div>
  );
}
