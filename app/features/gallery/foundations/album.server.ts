import type { GalleryImageModel } from "../view-models";

import type { GalleryFoundation } from "./types";

import {
  getAlbumImagesForEvent,
  getAllAlbumImages,
  type AlbumImageRow,
} from "~/models/gallery-album.server";

function toGalleryImageModel(row: AlbumImageRow): GalleryImageModel {
  const { album } = row;

  return {
    // the album membership is the image row, so there is no separate entry id
    id: row.image.id,
    image: row.image,
    // a dinner album is titled after its dinner by default, so the album title
    // is the better fallback; the dinner's own title backs it up
    alt: row.altText?.trim() || album.title.trim() || album.event?.title || "",
    caption: row.caption,
    event: album.event,
  };
}

export const foundation: GalleryFoundation = {
  id: "album",
  label: "album",
  description:
    "A gallery becomes a thing you can name and reuse — including one that belongs to no dinner — paid for with a second table and a get-or-create before the first upload.",
  async listAll() {
    const rows = await getAllAlbumImages();
    return rows.map(toGalleryImageModel);
  },
  async listForEvent(eventId) {
    const rows = await getAlbumImagesForEvent(eventId);
    return rows.map(toGalleryImageModel);
  },
};
