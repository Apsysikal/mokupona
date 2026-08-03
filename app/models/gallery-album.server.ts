import type { Album, Prisma } from "#prisma/generated/client";

import { prisma } from "~/db.server";
import {
  IMAGE_METADATA_SELECT,
  type ImageCreateData,
  type ImageMetadata,
} from "~/models/image.server";

export type { Album };

/** The dinner an album hangs on, as much as the read side needs of it. */
export interface AlbumEventRef {
  id: string;
  title: string;
  date: Date;
}

export interface AlbumRef {
  id: string;
  title: string;
  /** null for an album that is about no dinner at all ("kitchen life") */
  event: AlbumEventRef | null;
}

/**
 * One image in an album. The `image` projection is the row's own metadata —
 * under this foundation the album membership IS the image row, so the entry
 * has no identity of its own and `image.id` identifies both.
 */
export interface AlbumImageRow {
  image: ImageMetadata;
  altText: string | null;
  caption: string | null;
  position: number;
  album: AlbumRef;
}

export interface AlbumWithImages extends AlbumRef {
  description: string;
  images: AlbumImageRow[];
}

export interface AlbumSummary extends AlbumRef {
  description: string;
  imageCount: number;
}

export interface AlbumDefaults {
  title: string;
  description?: string;
}

/** What an upload persists per album image: the stored scalars plus its copy. */
export type AlbumImageCreateData = ImageCreateData & {
  altText?: string | null;
  caption?: string | null;
};

const ALBUM_EVENT_SELECT = {
  select: { id: true, title: true, date: true },
} satisfies Prisma.Album$eventArgs;

// Images sit in display order inside their album; `position` is dense and
// append-only (see addImagesToAlbum), so it doubles as a stable tiebreaker.
const ALBUM_IMAGES_SELECT = {
  select: {
    ...IMAGE_METADATA_SELECT,
    altText: true,
    caption: true,
    position: true,
  },
  orderBy: { position: "asc" },
} satisfies Prisma.Album$imagesArgs;

const ALBUM_WITH_IMAGES_SELECT = {
  id: true,
  title: true,
  description: true,
  event: ALBUM_EVENT_SELECT,
  images: ALBUM_IMAGES_SELECT,
} satisfies Prisma.AlbumSelect;

type AlbumWithImagesRecord = Prisma.AlbumGetPayload<{
  select: typeof ALBUM_WITH_IMAGES_SELECT;
}>;

function toAlbumImageRows(album: AlbumWithImagesRecord): AlbumImageRow[] {
  const ref: AlbumRef = {
    id: album.id,
    title: album.title,
    event: album.event,
  };

  return album.images.map(({ altText, caption, position, ...image }) => ({
    image,
    altText,
    caption,
    position,
    album: ref,
  }));
}

function toAlbumWithImages(album: AlbumWithImagesRecord): AlbumWithImages {
  return {
    id: album.id,
    title: album.title,
    description: album.description,
    event: album.event,
    images: toAlbumImageRows(album),
  };
}

/**
 * Dinner albums first, newest dinner first; albums that belong to no dinner
 * trail them in the order the query returned (newest created first).
 *
 * Sorted here rather than in SQL because "no dinner sorts last" would
 * otherwise ride on the database's NULL collation inside a `date: desc`.
 */
function compareAlbums(
  a: { event: { date: Date } | null },
  b: { event: { date: Date } | null },
): number {
  if (a.event && b.event)
    return b.event.date.getTime() - a.event.date.getTime();
  if (a.event) return -1;
  if (b.event) return 1;
  return 0;
}

export async function getAlbums(): Promise<AlbumSummary[]> {
  const albums = await prisma.album.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      description: true,
      event: ALBUM_EVENT_SELECT,
      _count: { select: { images: true } },
    },
  });

  return albums.sort(compareAlbums).map(({ _count, ...album }) => ({
    ...album,
    imageCount: _count.images,
  }));
}

export async function getAlbumWithImages(
  albumId: string,
): Promise<AlbumWithImages | null> {
  const album = await prisma.album.findUnique({
    where: { id: albumId },
    select: ALBUM_WITH_IMAGES_SELECT,
  });

  return album && toAlbumWithImages(album);
}

// `Album.eventId` is @unique, so a dinner has at most one album — null here
// means the dinner has no gallery yet, never "which one?".
export async function getAlbumForEvent(
  eventId: string,
): Promise<AlbumWithImages | null> {
  const album = await prisma.album.findUnique({
    where: { eventId },
    select: ALBUM_WITH_IMAGES_SELECT,
  });

  return album && toAlbumWithImages(album);
}

export async function getAllAlbumImages(): Promise<AlbumImageRow[]> {
  const albums = await prisma.album.findMany({
    where: { images: { some: {} } },
    orderBy: { createdAt: "desc" },
    select: ALBUM_WITH_IMAGES_SELECT,
  });

  return albums.sort(compareAlbums).flatMap(toAlbumImageRows);
}

export async function getAlbumImagesForEvent(
  eventId: string,
): Promise<AlbumImageRow[]> {
  const album = await prisma.album.findUnique({
    where: { eventId },
    select: ALBUM_WITH_IMAGES_SELECT,
  });

  return album ? toAlbumImageRows(album) : [];
}

/**
 * Get-or-create the dinner's album. The upsert is safe precisely because
 * `eventId` is @unique: a double-submitted first upload collides on the
 * constraint instead of forking the dinner into two galleries.
 */
export async function ensureAlbumForEvent(
  eventId: string,
  defaults: AlbumDefaults,
): Promise<Album> {
  return prisma.album.upsert({
    where: { eventId },
    create: {
      eventId,
      title: defaults.title,
      description: defaults.description ?? "",
    },
    update: {},
  });
}

export async function createStandaloneAlbum(
  data: AlbumDefaults,
): Promise<Album> {
  return prisma.album.create({
    data: { title: data.title, description: data.description ?? "" },
  });
}

export async function updateAlbum(
  albumId: string,
  data: Partial<AlbumDefaults>,
): Promise<Album> {
  return prisma.album.update({ where: { id: albumId }, data });
}

/**
 * Append a batch of freshly stored images to the album. The max-position read
 * and the inserts share one transaction so two concurrent uploads cannot hand
 * out the same positions.
 */
export async function addImagesToAlbum(
  albumId: string,
  images: AlbumImageCreateData[],
): Promise<number> {
  if (images.length === 0) return 0;

  return prisma.$transaction(async (tx) => {
    const { _max } = await tx.image.aggregate({
      where: { albumId },
      _max: { position: true },
    });
    const firstPosition = (_max.position ?? -1) + 1;

    const { count } = await tx.image.createMany({
      data: images.map((image, index) => ({
        ...image,
        albumId,
        position: firstPosition + index,
      })),
    });

    return count;
  });
}

// The caller destroys the returned storageKey's provider asset AFTER this
// transaction committed (a leaked asset on crash is acceptable, a dangling DB
// reference is not). Scoped to album images so a stray id can never take a
// dinner cover or a board-member portrait with it.
export async function removeAlbumImage(
  imageId: string,
): Promise<{ storageKey: string }> {
  return prisma.$transaction(async (tx) => {
    const image = await tx.image.findFirstOrThrow({
      where: { id: imageId, albumId: { not: null } },
      select: { storageKey: true },
    });
    await tx.image.delete({ where: { id: imageId } });

    return image;
  });
}
