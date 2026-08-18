import type { GalleryImageModel } from "../view-models";

/**
 * Where a layout is rendering.
 *
 * - `page` — the standalone /gallery route: every image in the app, so the
 *   layout is free to take the full width and label which dinner an image
 *   came from.
 * - `section` — embedded in a past dinner's detail page: one dinner's images
 *   only, sharing the page with the story column, so the layout must stay
 *   compact and drop the (redundant) dinner labels.
 */
export type GalleryLayoutVariant = "page" | "section";

export interface GalleryLayoutProps {
  images: GalleryImageModel[];
  variant?: GalleryLayoutVariant;
}
