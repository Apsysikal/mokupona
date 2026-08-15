import type { EventGalleryImage, Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import {
  IMAGE_METADATA_SELECT,
  type ImageCreateData,
  type ImageMetadata,
} from "~/models/image.server";

export type { EventGalleryImage };

/** The dinner an entry hangs in, as much as the gallery reads of it. */
export interface GalleryEntryEvent {
  id: string;
  title: string;
  date: Date;
}

/** A dinner reference thin enough for the reuse labels. */
export interface GalleryEventLabel {
  id: string;
  title: string;
}

export interface GalleryEntry {
  /** the membership id — what the admin UI removes, never the image id */
  id: string;
  caption: string | null;
  position: number;
  /** lives on the image row; callers fall back to the dinner title */
  altText: string | null;
  image: ImageMetadata;
  event: GalleryEntryEvent;
}

export interface GalleryEntryWithReuse extends GalleryEntry {
  /** the other dinners whose gallery shows the very same image */
  sharedWith: GalleryEventLabel[];
}

export interface LinkableImage {
  image: ImageMetadata;
  altText: string | null;
  /** empty for an image no dinner has claimed yet — a valid resting state */
  usedIn: GalleryEventLabel[];
}

/** Image scalars plus the metadata the entry itself does not carry. */
export type GalleryImageCreateData = ImageCreateData & {
  altText?: string | null;
  caption?: string | null;
};

export interface RemovedGalleryEntry {
  imageId: string;
  storageKey: string;
  /** nothing references the image anymore — the caller may collect it */
  orphaned: boolean;
}

const ENTRY_SELECT = {
  id: true,
  caption: true,
  position: true,
  image: { select: { ...IMAGE_METADATA_SELECT, altText: true } },
  event: { select: { id: true, title: true, date: true } },
} satisfies Prisma.EventGalleryImageSelect;

const ENTRY_WITH_REUSE_SELECT = {
  ...ENTRY_SELECT,
  image: {
    select: {
      ...IMAGE_METADATA_SELECT,
      altText: true,
      galleryLinks: {
        select: { eventId: true, event: { select: { id: true, title: true } } },
      },
    },
  },
} satisfies Prisma.EventGalleryImageSelect;

// newest dinner first, then the dinner's own display order
const ENTRY_ORDER_BY = [
  { event: { date: "desc" } },
  { position: "asc" },
] satisfies Prisma.EventGalleryImageOrderByWithRelationInput[];

// The picker (and the orphan rule) treat an image as gallery material only
// when no slot owns it: not a dinner cover, not a board portrait.
const UNOWNED_IMAGE: Prisma.ImageWhereInput = {
  event: null,
  boardMember: null,
};

type EntryRow = Prisma.EventGalleryImageGetPayload<{
  select: typeof ENTRY_SELECT;
}>;
type EntryWithReuseRow = Prisma.EventGalleryImageGetPayload<{
  select: typeof ENTRY_WITH_REUSE_SELECT;
}>;

function toGalleryEntry(row: EntryRow): GalleryEntry {
  const { altText, ...image } = row.image;

  return {
    id: row.id,
    caption: row.caption,
    position: row.position,
    altText,
    image,
    event: row.event,
  };
}

function toGalleryEntryWithReuse(
  row: EntryWithReuseRow,
): GalleryEntryWithReuse {
  const { altText, galleryLinks, ...image } = row.image;

  return {
    id: row.id,
    caption: row.caption,
    position: row.position,
    altText,
    image,
    event: row.event,
    sharedWith: galleryLinks
      .filter((entry) => entry.eventId !== row.event.id)
      .map((entry) => entry.event),
  };
}

async function nextPositionInTx(
  tx: Prisma.TransactionClient,
  eventId: string,
): Promise<number> {
  const { _max } = await tx.eventGalleryImage.aggregate({
    where: { eventId },
    _max: { position: true },
  });

  return (_max.position ?? -1) + 1;
}

/** Every membership in the app, newest dinner first. */
export async function getGalleryEntries(): Promise<GalleryEntry[]> {
  const entries = await prisma.eventGalleryImage.findMany({
    select: ENTRY_SELECT,
    orderBy: ENTRY_ORDER_BY,
  });

  return entries.map(toGalleryEntry);
}

export async function getGalleryEntriesForEvent(
  eventId: string,
): Promise<GalleryEntryWithReuse[]> {
  const entries = await prisma.eventGalleryImage.findMany({
    where: { eventId },
    select: ENTRY_WITH_REUSE_SELECT,
    orderBy: { position: "asc" },
  });

  return entries.map(toGalleryEntryWithReuse);
}

/**
 * Upload path: persist freshly stored images and grant each one membership in
 * this dinner, appending after the current last entry. One transaction, so a
 * failed entry write cannot leave an image row nothing points at.
 */
export async function createGalleryImagesForEvent(
  eventId: string,
  images: GalleryImageCreateData[],
): Promise<EventGalleryImage[]> {
  if (images.length === 0) return [];

  return prisma.$transaction(async (tx) => {
    let position = await nextPositionInTx(tx, eventId);
    const entries: EventGalleryImage[] = [];

    for (const { altText, caption, ...image } of images) {
      const created = await tx.image.create({
        data: { ...image, altText: altText ?? null },
      });

      entries.push(
        await tx.eventGalleryImage.create({
          data: {
            eventId,
            imageId: created.id,
            caption: caption ?? null,
            position: position++,
          },
        }),
      );
    }

    return entries;
  });
}

/**
 * Reuse path: grant existing images membership in this dinner. Unknown ids
 * and images already in the gallery are skipped — SQLite has no
 * `skipDuplicates`, and the (eventId, imageId) unique would otherwise turn a
 * double-submitted picker into a 500.
 */
export async function linkExistingImagesToEvent(
  eventId: string,
  imageIds: string[],
): Promise<EventGalleryImage[]> {
  const ids = [...new Set(imageIds)];
  if (ids.length === 0) return [];

  return prisma.$transaction(async (tx) => {
    const [linked, known] = await Promise.all([
      tx.eventGalleryImage.findMany({
        where: { eventId, imageId: { in: ids } },
        select: { imageId: true },
      }),
      tx.image.findMany({ where: { id: { in: ids } }, select: { id: true } }),
    ]);

    const alreadyLinked = new Set(linked.map((entry) => entry.imageId));
    const exists = new Set(known.map((image) => image.id));
    const toLink = ids.filter((id) => exists.has(id) && !alreadyLinked.has(id));
    if (toLink.length === 0) return [];

    let position = await nextPositionInTx(tx, eventId);

    const entries: EventGalleryImage[] = [];
    for (const imageId of toLink) {
      entries.push(
        await tx.eventGalleryImage.create({
          data: { eventId, imageId, position: position++ },
        }),
      );
    }

    return entries;
  });
}

/**
 * Unlink one image from one dinner. The image row survives by design — it may
 * still hang in another dinner's gallery, and destroying it there is the bug
 * this foundation exists to prevent. `orphaned` reports that nothing
 * references it anymore, leaving the collect-or-keep call to the caller.
 */
export async function removeGalleryEntry(
  entryId: string,
): Promise<RemovedGalleryEntry | null> {
  return prisma.$transaction(async (tx) => {
    const entry = await tx.eventGalleryImage.findUnique({
      where: { id: entryId },
      select: {
        imageId: true,
        image: {
          select: {
            storageKey: true,
            event: { select: { id: true } },
            boardMember: { select: { id: true } },
          },
        },
      },
    });
    if (!entry) return null;

    await tx.eventGalleryImage.delete({ where: { id: entryId } });

    const remaining = await tx.eventGalleryImage.count({
      where: { imageId: entry.imageId },
    });
    const { storageKey, event, boardMember } = entry.image;

    return {
      imageId: entry.imageId,
      storageKey,
      orphaned: remaining === 0 && event === null && boardMember === null,
    };
  });
}

/**
 * Collect an image the last unlink left behind. Ownership is re-checked
 * inside the transaction, so an image re-linked in the meantime is kept and
 * `null` comes back; a returned storageKey is safe to destroy at the provider.
 */
export async function deleteOrphanedImage(
  imageId: string,
): Promise<string | null> {
  return prisma.$transaction(async (tx) => {
    const image = await tx.image.findFirst({
      where: { id: imageId, galleryLinks: { none: {} }, ...UNOWNED_IMAGE },
      select: { storageKey: true },
    });
    if (!image) return null;

    await tx.image.delete({ where: { id: imageId } });
    return image.storageKey;
  });
}

/** The reuse pool: gallery-eligible images this dinner does not show yet. */
export async function getLinkableImages(
  eventId: string,
): Promise<LinkableImage[]> {
  const images = await prisma.image.findMany({
    where: { galleryLinks: { none: { eventId } }, ...UNOWNED_IMAGE },
    select: {
      ...IMAGE_METADATA_SELECT,
      altText: true,
      galleryLinks: {
        select: { event: { select: { id: true, title: true } } },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return images.map(({ altText, galleryLinks, ...image }) => ({
    image,
    altText,
    usedIn: galleryLinks.map((entry) => entry.event),
  }));
}
