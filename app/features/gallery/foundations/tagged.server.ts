import type { GalleryFoundation } from "./types";

import type { GalleryImageModel } from "~/features/gallery/view-models";
import {
  getTaggedGalleryImages,
  getTaggedGalleryImagesForEvent,
  type TaggedGalleryImage,
} from "~/models/gallery-tagged.server";

function toGalleryImageModel(row: TaggedGalleryImage): GalleryImageModel {
  const { image, altText, caption, event } = row;

  return {
    // the image row IS the membership here, so its id is the entry id
    id: image.id,
    image,
    alt: altText?.trim() || event.title,
    caption,
    event,
  };
}

export const foundation: GalleryFoundation = {
  id: "tagged",
  label: "tagged",
  description:
    "One extra FK on Image and no new tables — but a photo can hang under a single dinner, and removing it from the gallery destroys the image.",

  async listAll() {
    const rows = await getTaggedGalleryImages();
    return rows.map(toGalleryImageModel);
  },

  async listForEvent(eventId) {
    const rows = await getTaggedGalleryImagesForEvent(eventId);
    return rows.map(toGalleryImageModel);
  },
};
