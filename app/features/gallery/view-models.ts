// Client-safe: the one render-ready shape every gallery foundation maps its
// rows into, so the layouts never learn which foundation produced them.
//
// The gallery ships as three competing foundations (see
// app/features/gallery/foundations) and three layouts
// (app/features/gallery/layouts). This file is the seam between them: a
// foundation may only ever hand out `GalleryImageModel[]`, and a layout may
// only ever consume it.

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
   * id: under the "join" foundation one image can hold several memberships,
   * and removing one must not touch the others.
   */
  id: string;
  image: ImageMetadata;
  /** never null — foundations fall back to the dinner title */
  alt: string;
  caption: string | null;
  /** null for images no dinner claims ("join" and "album" both allow it) */
  event: GalleryEventRef | null;
}

export interface GalleryGroup {
  /** null groups the images that belong to no dinner */
  event: GalleryEventRef | null;
  images: GalleryImageModel[];
}

/**
 * Group a flat gallery feed by dinner, preserving the order the foundation
 * returned (foundations sort newest dinner first, images in display order).
 * Unclaimed images collect in a single trailing `event: null` group.
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
