import { z } from "zod";

export const IMAGE_FITS = ["cover", "contain", "fill"] as const;
export type ImageFit = (typeof IMAGE_FITS)[number];

/**
 * What URL building needs to know about an image. DB-backed images carry an
 * `id` (their `/file/:fileId` fallback identity); static marketing assets are
 * public_id-only (`storageKey`, no `id`).
 */
export interface ImageUrlSource {
  id?: string | null;
  /** Cloudinary public_id / local file key; null until a row is backfilled. */
  storageKey?: string | null;
  /** Cloudinary asset version — versioned URLs make CDN invalidation moot. */
  version?: number | null;
}

/** The root loader's public image-delivery fields (never the API secret). */
export interface ImageProviderConfig {
  imageProvider: "local" | "cloudinary";
  cloudinaryCloudName: string | null;
}

export interface ImageTransformOptions {
  width?: number;
  height?: number;
  fit?: ImageFit;
}

// c_fill,g_auto replaces the old sharp fit=cover; the CSS-ish contain/fill
// map to Cloudinary's fit/scale crops
const CLOUDINARY_CROPS: Record<ImageFit, string> = {
  cover: "c_fill,g_auto",
  contain: "c_fit",
  fill: "c_scale",
};

function cloudinaryTransform({
  width,
  height,
  fit = "cover",
}: ImageTransformOptions) {
  // f_auto,q_auto: per-browser format (avif/webp) and quality on the CDN
  const parts = ["f_auto", "q_auto"];
  if (width !== undefined || height !== undefined) {
    parts.push(CLOUDINARY_CROPS[fit]);
    if (width !== undefined) parts.push(`w_${width}`);
    if (height !== undefined) parts.push(`h_${height}`);
  }
  return parts.join(",");
}

/**
 * Client-safe, isomorphic delivery-URL builder (design §3.2).
 *
 * - Cloudinary: a plain `res.cloudinary.com` URL — the app is not in the
 *   serving path. Static assets (no `id`) use it whenever a cloud name is
 *   configured, independent of `imageProvider` (delivery needs no secrets).
 * - Local provider, no storage key yet (pre-backfill row), or no cloud name:
 *   the `/file/:fileId` resource route. Transforms are dropped — dev and the
 *   interim blob path serve original bytes.
 * - A static asset without a cloud name renders nothing (offline dev hero).
 */
export function getImageUrl(
  image: ImageUrlSource,
  config: ImageProviderConfig,
  options: ImageTransformOptions = {},
): string {
  const { storageKey, version, id } = image;
  const { imageProvider, cloudinaryCloudName } = config;

  const cloudinaryEligible =
    storageKey &&
    cloudinaryCloudName &&
    (imageProvider === "cloudinary" || !id);

  if (cloudinaryEligible) {
    const versionSegment = version == null ? "" : `v${version}/`;
    return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/${cloudinaryTransform(options)}/${versionSegment}${storageKey}`;
  }

  return id ? `/file/${id}` : "";
}

export function isImageFit(value: unknown): value is ImageFit {
  return typeof value === "string" && IMAGE_FITS.some((fit) => fit === value);
}

export const RESPONSIVE_IMAGE_WIDTHS = [432, 648, 864, 1080] as const;

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_STAGED_IMAGE_BYTES = 4 * 1024 * 1024;
export const IMAGE_SIZE_ERROR = "File cannot be greater than 3MB";

// Client-safe: the accepted types back every image input's `accept`
// attribute; they are advertisory only — the schema deliberately validates
// size, not MIME type.
export const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** The size-validated upload schema shared by cover and portrait images. */
export function imageFileSchema() {
  return z
    .instanceof(File, { message: "You must select a file" })
    .refine((file) => {
      return file.size !== 0;
    }, "You must select a file")
    .refine((file) => {
      return file.size <= MAX_IMAGE_BYTES;
    }, IMAGE_SIZE_ERROR);
}
