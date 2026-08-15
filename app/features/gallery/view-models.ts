// Client-safe: the render-ready shape gallery rows are mapped into (see
// app/features/gallery/gallery.server.ts), so the layout never learns which
// tables produced them.

import type { SerializableDate } from "~/features/events/view-models";
import type { ImageMetadata } from "~/models/image.server";

/** The dinner a gallery image belongs to, as much as a layout needs of it. */
export interface GalleryEventRef {
  id: string;
  title: string;
  date: SerializableDate;
}

export interface GalleryImageModel {
  /**
   * Entry identity — what the admin UI removes. Deliberately NOT the image
   * id: one image can hold several memberships, and removing one must not
   * touch the others.
   */
  id: string;
  image: ImageMetadata;
  /** never null — falls back to the dinner title */
  alt: string;
  caption: string | null;
  /** null for images no dinner claims */
  event: GalleryEventRef | null;
}

export interface GalleryGroup {
  /** null groups the images that belong to no dinner */
  event: GalleryEventRef | null;
  images: GalleryImageModel[];
}

/**
 * Group a flat gallery feed by dinner, preserving the incoming order (newest
 * dinner first, images in display order). Unclaimed images collect in a
 * single trailing `event: null` group.
 */
export function groupGalleryImagesByEvent(
  images: GalleryImageModel[],
): GalleryGroup[] {
  const groups: GalleryGroup[] = [];
  const byEventId = new Map<string, GalleryGroup>();
  let unclaimed: GalleryGroup | null = null;

  for (const image of images) {
    if (!image.event) {
      unclaimed ??= { event: null, images: [] };
      unclaimed.images.push(image);
      continue;
    }

    let group = byEventId.get(image.event.id);
    if (!group) {
      group = { event: image.event, images: [] };
      byEventId.set(image.event.id, group);
      groups.push(group);
    }
    group.images.push(image);
  }

  // the homeless group reads as an appendix, never as the lead
  return unclaimed ? [...groups, unclaimed] : groups;
}
