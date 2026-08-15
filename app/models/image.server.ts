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

/**
 * Every `Image` relation that counts as the image being in use, each paired
 * with the where-fragment matching images unused at that site. Usage lookups
 * and cleanup logic derive from this one list; the completeness test in
 * image.server.test.ts fails when the schema grows a relation to `Image`
 * this registry does not know about.
 */
export const IMAGE_REFERENCE_SITES = {
  event: { event: null },
  boardMember: { boardMember: null },
  galleryLinks: { galleryLinks: { none: {} } },
} as const satisfies Record<string, Prisma.ImageWhereInput>;

export type ImageReferenceSite = keyof typeof IMAGE_REFERENCE_SITES;

// Models-internal plumbing: matches images no reference site points at —
// the precondition for destroying an asset.
export const UNREFERENCED_IMAGE_WHERE: Prisma.ImageWhereInput = {
  AND: Object.values(IMAGE_REFERENCE_SITES),
};

// Matches images no slot claims — not a dinner cover, not a board portrait.
// Gallery membership does not count: the reuse pool and the seed treat
// slot-owned images as off limits whether or not a gallery shows them.
export const UNOWNED_IMAGE_WHERE: Prisma.ImageWhereInput = {
  AND: [IMAGE_REFERENCE_SITES.event, IMAGE_REFERENCE_SITES.boardMember],
};

/**
 * Delete-on-last-unlink, enforced: of the given images, delete those no
 * reference site points at anymore. Rows fall inside the caller's
 * transaction; the returned storageKeys are the caller's to destroy at the
 * provider after commit. Images something still references survive untouched.
 */
export async function releaseImagesIfUnreferenced(
  tx: Prisma.TransactionClient,
  imageIds: string[],
): Promise<{ deletedIds: string[]; storageKeys: string[] }> {
  const ids = [...new Set(imageIds)];
  if (ids.length === 0) return { deletedIds: [], storageKeys: [] };

  const unreferenced = await tx.image.findMany({
    where: { id: { in: ids }, ...UNREFERENCED_IMAGE_WHERE },
    select: { id: true, storageKey: true },
  });
  if (unreferenced.length === 0) return { deletedIds: [], storageKeys: [] };

  const deletedIds = unreferenced.map((image) => image.id);
  await tx.image.deleteMany({ where: { id: { in: deletedIds } } });

  return {
    deletedIds,
    storageKeys: unreferenced.map((image) => image.storageKey),
  };
}

// One select per reference site; the Record constraint keeps it covering
// exactly the registry.
const IMAGE_USAGE_SELECT = {
  event: { select: { id: true } },
  boardMember: { select: { id: true } },
  galleryLinks: { select: { eventId: true } },
} satisfies Prisma.ImageSelect & Record<ImageReferenceSite, object>;

export interface ImageUsage {
  /** the dinner whose cover slot holds the image */
  coverOfEventId: string | null;
  /** the board member whose portrait slot holds the image */
  portraitOfBoardMemberId: string | null;
  /** the dinners whose galleries link the image */
  galleryEventIds: string[];
}

/** Where an image is used, across every reference site. Null: no such image. */
export async function getImageUsage(id: string): Promise<ImageUsage | null> {
  const image = await prisma.image.findUnique({
    where: { id },
    select: IMAGE_USAGE_SELECT,
  });
  if (!image) return null;

  return {
    coverOfEventId: image.event?.id ?? null,
    portraitOfBoardMemberId: image.boardMember?.id ?? null,
    galleryEventIds: image.galleryLinks.map((link) => link.eventId),
  };
}
