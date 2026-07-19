import { z } from "zod";

/**
 * Client-safe: builds the resource-route URL serving an image; used from
 * client components (`OptimizedImage`) and `meta` functions, which also run
 * in the browser.
 */
export function getImageUrl(imageId: string) {
  return `/file/${imageId}`;
}

export const IMAGE_FITS = ["cover", "contain", "fill"] as const;
export type ImageFit = (typeof IMAGE_FITS)[number];

/**
 * Client-safe: builds the resource-route URL including the transform query
 * understood by the image route; shared by `src` and `srcSet` construction
 * so both request identical parameters.
 */
export function buildImageTransformUrl(
  imageId: string,
  { width, height, fit }: { width: number; height: number; fit: ImageFit },
) {
  const searchParams = new URLSearchParams({
    w: `${width}`,
    h: `${height}`,
    fit,
  });

  return `${getImageUrl(imageId)}?${searchParams.toString()}`;
}

export function isImageFit(value: unknown): value is ImageFit {
  return typeof value === "string" && IMAGE_FITS.some((fit) => fit === value);
}

export const RESPONSIVE_IMAGE_WIDTHS = [432, 648, 864, 1080] as const;

export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
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
