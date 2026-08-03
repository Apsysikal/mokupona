import { layout as grid } from "./grid";
import { layout as mosaic } from "./mosaic";
import { layout as stream } from "./stream";
import type { GalleryLayout } from "./types";

export type {
  GalleryLayout,
  GalleryLayoutProps,
  GalleryLayoutVariant,
} from "./types";

/** Switcher order — safe first, most opinionated last. */
export const GALLERY_LAYOUTS: readonly GalleryLayout[] = [grid, mosaic, stream];

export const DEFAULT_GALLERY_LAYOUT_ID = "mosaic";

export function getGalleryLayout(id: string): GalleryLayout | null {
  return GALLERY_LAYOUTS.find((layout) => layout.id === id) ?? null;
}

/** What the switcher ships to the client — the components stay behind the id. */
export interface GalleryLayoutOption {
  id: string;
  label: string;
  description: string;
}

export function galleryLayoutOptions(): GalleryLayoutOption[] {
  return GALLERY_LAYOUTS.map(({ id, label, description }) => ({
    id,
    label,
    description,
  }));
}
