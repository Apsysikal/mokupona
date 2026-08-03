import type { GalleryImageModel } from "../view-models";

import type { GalleryFoundation } from "./types";

import {
  getGalleryEntries,
  getGalleryEntriesForEvent,
  type GalleryEntry,
} from "~/models/gallery-join.server";

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

export const foundation: GalleryFoundation = {
  id: "join",
  label: "join",
  description:
    "one photo can hang in several dinners with its own caption, paid for with an extra table and a two-step unlink-then-collect delete",
  async listAll() {
    return (await getGalleryEntries()).map(toGalleryImageModel);
  },
  async listForEvent(eventId) {
    return (await getGalleryEntriesForEvent(eventId)).map(toGalleryImageModel);
  },
};
