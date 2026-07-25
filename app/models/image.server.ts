import type { Image, Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";

export type { Image };

/**
 * The read projection components need to render an image: enough for URL
 * building (storageKey/version), layout (intrinsic width/height) and the
 * blur-up placeholder. All-scalar and serialization-safe by construction.
 */
export interface ImageMetadata {
  id: string;
  storageKey: string;
  version: number | null;
  width: number | null;
  height: number | null;
  blurDataUrl: string | null;
}

// Models-internal plumbing: the select the owning models' includes share so
// their `image` projections cannot drift from ImageMetadata.
export const IMAGE_METADATA_SELECT = {
  id: true,
  storageKey: true,
  version: true,
  width: true,
  height: true,
  blurDataUrl: true,
} satisfies Prisma.ImageSelect;

/**
 * What owning models persist for a provider-stored image: the upload's MIME
 * type plus the `StoredImage` scalars the provider returned. Bytes never
 * cross this boundary — the provider owns the file, the row owns the key.
 */
export interface ImageCreateData {
  contentType: string;
  storageKey: string;
  version?: number | null;
  width?: number | null;
  height?: number | null;
  blurDataUrl?: string | null;
}

export async function getImageById(id: string): Promise<Image | null> {
  return prisma.image.findUnique({ where: { id } });
}
