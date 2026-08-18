import { listGalleryImagesForEvent } from "./gallery.server";
import type { GalleryImageModel } from "./view-models";

export interface EventGallerySectionData {
  images: GalleryImageModel[];
}

/** One dinner's gallery for its detail page. */
export async function loadEventGallerySection(
  eventId: string,
): Promise<EventGallerySectionData> {
  return { images: await listGalleryImagesForEvent(eventId) };
}
