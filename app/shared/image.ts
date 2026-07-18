import { z } from "zod";

/**
 * Client-safe: builds the resource-route URL serving an image; used from
 * client components (`OptimizedImage`) and `meta` functions, which also run
 * in the browser.
 */
export function getImageUrl(imageId: string) {
  return `/file/${imageId}`;
}

// Client-safe: the accepted types back every image input's `accept`
// attribute; they are advertisory only — the schema deliberately validates
// size, not MIME type.
export const VALID_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** The size-validated upload schema shared by cover and portrait images. */
export function imageFileSchema(maxBytes: number) {
  return z
    .instanceof(File, { message: "You must select a file" })
    .refine((file) => {
      return file.size !== 0;
    }, "You must select a file")
    .refine((file) => {
      return file.size <= maxBytes;
    }, "File cannot be greater than 3MB");
}
