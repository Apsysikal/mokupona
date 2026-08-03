import {
  DEFAULT_GALLERY_FOUNDATION_ID,
  getGalleryFoundation,
} from "./foundations/index.server";
import {
  DEFAULT_GALLERY_LAYOUT_ID,
  getGalleryLayout,
} from "./layouts";
import type { GalleryImageModel } from "./view-models";

export interface EventGallerySectionData {
  images: GalleryImageModel[];
  foundationId: string;
  layoutId: string;
}

/**
 * One dinner's gallery for its detail page.
 *
 * While the prototypes run, `?gallery=` and `?layout=` pick which pair a past
 * dinner renders with, so a reviewer can compare all nine combinations without
 * leaving the page they care about. Unknown or absent values fall back to the
 * defaults rather than 404ing — this is a decoration on someone else's page.
 */
export async function loadEventGallerySection(
  request: Request,
  eventId: string,
): Promise<EventGallerySectionData> {
  const searchParams = new URL(request.url).searchParams;

  const foundation =
    getGalleryFoundation(searchParams.get("gallery") ?? "") ??
    getGalleryFoundation(DEFAULT_GALLERY_FOUNDATION_ID);
  const layoutId =
    getGalleryLayout(searchParams.get("layout") ?? "")?.id ??
    DEFAULT_GALLERY_LAYOUT_ID;

  if (!foundation) {
    // unreachable: the default id is a member of the registry
    return { images: [], foundationId: "", layoutId };
  }

  return {
    images: await foundation.listForEvent(eventId),
    foundationId: foundation.id,
    layoutId,
  };
}
