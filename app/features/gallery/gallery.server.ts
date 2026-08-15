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

/** Every gallery image in the app — newest dinner first, then display order. */
export async function listGalleryImages(): Promise<GalleryImageModel[]> {
  return (await getGalleryEntries()).map(toGalleryImageModel);
}

/** One dinner's gallery, in display order. */
export async function listGalleryImagesForEvent(
  eventId: string,
): Promise<GalleryImageModel[]> {
  return (await getGalleryEntriesForEvent(eventId)).map(toGalleryImageModel);
}
