import type { GalleryImageModel } from "./view-models";

import {
  getGalleryEntries,
  getGalleryEntriesForEvent,
  type GalleryEntry,
} from "~/models/gallery.server";

function toGalleryImageModel(entry: GalleryEntry): GalleryImageModel {
  return {
    // the membership, not the image: the same photo can hold several
    id: entry.id,
    image: entry.image,
    alt: entry.altText?.trim() || entry.event.title,
    caption: entry.caption,
    event: entry.event,
  };
}

/**
 * Every gallery image from a dinner that already happened — newest dinner
 * first, then display order. An upcoming dinner's photos stay unlisted here
 * for the same reason its own page hides them.
 */
export async function listGalleryImages(
  now: Date = new Date(),
): Promise<GalleryImageModel[]> {
  return (await getGalleryEntries(now)).map(toGalleryImageModel);
}

/** One dinner's gallery, in display order. */
export async function listGalleryImagesForEvent(
  eventId: string,
): Promise<GalleryImageModel[]> {
  return (await getGalleryEntriesForEvent(eventId)).map(toGalleryImageModel);
}
