import type { Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import {
  IMAGE_METADATA_SELECT,
  type ImageCreateData,
  type ImageMetadata,
} from "~/models/image.server";

/**
 * Gallery foundation A ("tagged"): membership is a second, non-unique event FK
 * on Image (`galleryEventId`) next to the cover's `eventId`, with the caption
 * and the display position on the image row itself. No join table, no album —
 * an image belongs to at most one dinner's gallery, and unlinking it means
 * deleting the row (and its provider asset with it).
 */

/** The dinner a tagged image hangs off; always present on a gallery row. */
export interface TaggedGalleryEvent {
  id: string;
  title: string;
  date: Date;
}

export interface TaggedGalleryImage {
  image: ImageMetadata;
  altText: string | null;
  caption: string | null;
  position: number;
  event: TaggedGalleryEvent;
}

/** An upload's provider scalars plus the copy stored alongside them. */
export interface TaggedGalleryImageCreateData extends ImageCreateData {
  altText?: string | null;
  caption?: string | null;
}

const TAGGED_GALLERY_SELECT = {
  ...IMAGE_METADATA_SELECT,
  altText: true,
  caption: true,
  position: true,
  galleryEvent: { select: { id: true, title: true, date: true } },
} satisfies Prisma.ImageSelect;

type TaggedGalleryRow = Prisma.ImageGetPayload<{
  select: typeof TAGGED_GALLERY_SELECT;
}>;

// Rows are only ever read through `galleryEventId: { not: null }` filters, so
// the relation is non-null in practice; the guard keeps that invariant honest
// instead of asserting it away.
function toTaggedGalleryImage(row: TaggedGalleryRow): TaggedGalleryImage {
  const { altText, caption, position, galleryEvent, ...image } = row;
  if (!galleryEvent) {
    throw new Error(`Gallery image ${row.id} has no dinner`);
  }
  return { image, altText, caption, position, event: galleryEvent };
}

/** Newest dinner first, then each dinner's images in display order. */
export async function getTaggedGalleryImages(): Promise<TaggedGalleryImage[]> {
  const rows = await prisma.image.findMany({
    where: { galleryEventId: { not: null } },
    select: TAGGED_GALLERY_SELECT,
    orderBy: [
      { galleryEvent: { date: "desc" } },
      { position: "asc" },
      { createdAt: "asc" },
    ],
  });

  return rows.map(toTaggedGalleryImage);
}

export async function getTaggedGalleryImagesForEvent(
  eventId: string,
): Promise<TaggedGalleryImage[]> {
  const rows = await prisma.image.findMany({
    where: { galleryEventId: eventId },
    select: TAGGED_GALLERY_SELECT,
    orderBy: [{ position: "asc" }, { createdAt: "asc" }],
  });

  return rows.map(toTaggedGalleryImage);
}

export async function countTaggedGalleryImagesForEvent(
  eventId: string,
): Promise<number> {
  return prisma.image.count({ where: { galleryEventId: eventId } });
}

/**
 * Append an upload batch to a dinner's gallery. Reading the current maximum
 * position and writing the new rows in one transaction keeps two concurrent
 * uploads from claiming the same positions.
 */
export async function addTaggedGalleryImages(
  eventId: string,
  images: TaggedGalleryImageCreateData[],
): Promise<number> {
  if (images.length === 0) return 0;

  return prisma.$transaction(async (tx) => {
    const { _max } = await tx.image.aggregate({
      where: { galleryEventId: eventId },
      _max: { position: true },
    });
    const nextPosition = (_max.position ?? -1) + 1;

    const { count } = await tx.image.createMany({
      data: images.map((image, index) => ({
        ...image,
        galleryEventId: eventId,
        position: nextPosition + index,
      })),
    });

    return count;
  });
}

/**
 * Unlink means delete here — the row is the membership. Returns the deleted
 * row's storageKey so the caller can destroy the provider asset AFTER the
 * transaction committed (same contract as `deleteEvent`), and null when the
 * image was already gone or never belonged to a gallery.
 */
export async function removeTaggedGalleryImage(
  imageId: string,
): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const image = await tx.image.findFirst({
      where: { id: imageId, galleryEventId: { not: null } },
      select: { storageKey: true },
    });
    if (!image) return null;

    await tx.image.delete({ where: { id: imageId } });

    return image.storageKey;
  });
}
