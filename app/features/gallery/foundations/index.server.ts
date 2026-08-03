import { foundation as album } from "./album.server";
import { foundation as join } from "./join.server";
import { foundation as tagged } from "./tagged.server";
import {
  isGalleryFoundationId,
  type GalleryFoundation,
  type GalleryFoundationId,
  type GalleryFoundationOption,
} from "./types";

export {
  GALLERY_FOUNDATION_IDS,
  isGalleryFoundationId,
  type GalleryFoundation,
  type GalleryFoundationId,
  type GalleryFoundationOption,
} from "./types";

/** Switcher order — cheapest schema change first, heaviest last. */
export const GALLERY_FOUNDATIONS: readonly GalleryFoundation[] = [
  tagged,
  join,
  album,
];

export const DEFAULT_GALLERY_FOUNDATION_ID: GalleryFoundationId = "tagged";

export function getGalleryFoundation(id: string): GalleryFoundation | null {
  if (!isGalleryFoundationId(id)) return null;
  return GALLERY_FOUNDATIONS.find((foundation) => foundation.id === id) ?? null;
}

export function galleryFoundationOptions(): GalleryFoundationOption[] {
  return GALLERY_FOUNDATIONS.map(({ id, label, description }) => ({
    id,
    label,
    description,
  }));
}
