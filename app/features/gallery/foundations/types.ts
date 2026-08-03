import type { GalleryImageModel } from "../view-models";

export const GALLERY_FOUNDATION_IDS = ["tagged", "join", "album"] as const;
export type GalleryFoundationId = (typeof GALLERY_FOUNDATION_IDS)[number];

export function isGalleryFoundationId(
  value: string,
): value is GalleryFoundationId {
  return (GALLERY_FOUNDATION_IDS as readonly string[]).includes(value);
}

/**
 * What the switcher ships to the client. The foundation modules themselves
 * are server-only (they reach Prisma), so routes serialize this projection
 * into loader data instead.
 */
export interface GalleryFoundationOption {
  id: GalleryFoundationId;
  label: string;
  description: string;
}

/**
 * The read side every foundation exposes. Writes stay foundation-specific
 * (their admin pages differ on purpose — that is half of what is being
 * compared), but reads are uniform so the public routes and all three layouts
 * work against any of the three.
 */
export interface GalleryFoundation {
  id: GalleryFoundationId;
  /** lowercase, for the switcher chip */
  label: string;
  /** one line: what this foundation buys and what it costs */
  description: string;
  /** every gallery image in the app — newest dinner first, then display order */
  listAll(): Promise<GalleryImageModel[]>;
  /** one dinner's gallery, in display order */
  listForEvent(eventId: string): Promise<GalleryImageModel[]>;
}
