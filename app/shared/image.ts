import { z } from "zod";

const IMAGE_FITS = ["cover", "contain", "fill"] as const;
export type ImageFit = (typeof IMAGE_FITS)[number];

/**
 * What URL building needs to know about an image. DB-backed images carry an
 * `id` (their `/file/:fileId` fallback identity); static marketing assets are
 * public_id-only (`storageKey`, no `id`).
 */
export interface ImageUrlSource {
  id?: string | null;
  /** Cloudinary public_id / local file key — required on every row. */
  storageKey: string;
  /** Cloudinary asset version — versioned URLs make CDN invalidation moot. */
  version?: number | null;
}

/**
 * What rendering components consume: URL identity plus intrinsic dimensions
 * (aspect-ratio reservation) and the blur-up placeholder. The models'
 * `ImageMetadata` projection satisfies this shape structurally.
 */
export interface ImageDisplaySource extends ImageUrlSource {
  width?: number | null;
  height?: number | null;
  blurDataUrl?: string | null;
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

// The CSS-ish fit names map onto Cloudinary's crop modes
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

export function getImageUrl(
  image: ImageUrlSource,
  config: ImageProviderConfig,
  options: ImageTransformOptions = {},
): string {
  const { storageKey, version, id } = image;
  const { imageProvider, cloudinaryCloudName } = config;

  const cloudinaryEligible =
    cloudinaryCloudName && (imageProvider === "cloudinary" || !id);

  if (cloudinaryEligible) {
    const versionSegment = version == null ? "" : `v${version}/`;
    return `https://res.cloudinary.com/${cloudinaryCloudName}/image/upload/${cloudinaryTransform(options)}/${versionSegment}${storageKey}`;
  }

  return id ? `/file/${id}` : "";
}

export const RESPONSIVE_IMAGE_WIDTHS = [432, 648, 864, 1080] as const;

const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_STAGED_IMAGE_BYTES = 4 * 1024 * 1024;
/**
 * How many files a gallery upload may carry in one submission. Policy, not
 * plumbing: the admin pages print it in their field description, so it has to
 * live in a module the client bundle is allowed to reach.
 */
export const MAX_GALLERY_FILES = 12;
export const IMAGE_SIZE_ERROR = "File cannot be greater than 3MB";
export const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const IMAGE_TYPE_ERROR = "File must be a JPEG, PNG or WebP image";

/**
 * The upload schema shared by cover and portrait images: size-capped and
 * MIME-allowlisted server-side.
 */
export function imageFileSchema() {
  return z
    .instanceof(File, { message: "You must select a file" })
    .refine((file) => {
      return file.size !== 0;
    }, "You must select a file")
    .refine((file) => {
      return file.size <= MAX_IMAGE_BYTES;
    }, IMAGE_SIZE_ERROR)
    .refine((file) => {
      return VALID_IMAGE_TYPES.includes(file.type);
    }, IMAGE_TYPE_ERROR);
}
