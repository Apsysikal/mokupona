import { z } from "zod";

import type { Route } from "./+types/file.$fileId";

import {
  fileStorage as cache,
  getStorageKey as getCacheKey,
} from "~/features/uploads/file-cache-storage.server";
import { getImageById } from "~/models/image.server";
import { requireFound } from "~/shared/http.server";
import { IMAGE_FITS } from "~/shared/image";
import { transformToWebp } from "~/utils/image-transform.server";

// Transform URLs outlive the components that emitted them (scraped og:image
// previews, sent emails, open tabs), so numeric dimensions are normalized
// rather than rejected: each snaps to the nearest ladder rung. That keeps
// every historically published URL serving an image while bounding the
// unauthenticated, never-evicted cache to ladder² × fits variants per image
// instead of one per arbitrary (w, h) pair. The rungs are the union of every
// geometry the app currently emits — RESPONSIVE_IMAGE_WIDTHS, the
// OptimizedImage call sites' width/height props, and their aspect-derived
// srcset heights — plus a few spacers up to a 2048 ceiling; a changed call
// site serves a near-identical crop until its geometry is added here.
const DIMENSION_LADDER = [
  96, 172, 208, 236, 324, 357, 432, 480, 486, 536, 640, 648, 714, 810, 864,
  893, 1080, 1296, 1536, 2048,
];

function snapToDimensionLadder(value: number): number {
  return DIMENSION_LADDER.reduce((closest, rung) =>
    Math.abs(rung - value) < Math.abs(closest - value) ? rung : closest,
  );
}

const SearchParamsSchema = z.object({
  width: z.coerce.number().transform(snapToDimensionLadder).optional(),
  height: z.coerce.number().transform(snapToDimensionLadder).optional(),
  fit: z.enum(IMAGE_FITS).optional().default("cover"),
});

// The storage returns LazyFiles, which undici no longer accepts as a
// Response body (lazy-file >= 5 does not implement File). Streaming the body
// also keeps cached transforms out of memory; `size` is storage metadata and
// does not read the file.
function createImageResponse(
  file: Pick<File, "size" | "stream">,
  fileId: string,
) {
  return new Response(file.stream(), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Disposition": `inline; filename="${fileId}"`,
      "Content-Length": String(file.size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function loader({ url, params }: Route.LoaderArgs) {
  const searchParams = new URL(url).searchParams;
  const { fileId } = params;

  const options = SearchParamsSchema.safeParse({
    width: searchParams.get("w") ?? undefined,
    height: searchParams.get("h") ?? undefined,
    fit: searchParams.get("fit") ?? undefined,
  });

  if (!options.success) {
    // Params were malformed
    throw new Response("Bad request", {
      status: 400,
    });
  }

  const { width, height, fit } = options.data;
  const cacheKey = getCacheKey(`${fileId}-${width}-${height}-${fit}`);

  const cachedFile = await cache.get(cacheKey);
  if (cachedFile) {
    return createImageResponse(cachedFile, fileId);
  }

  const file = requireFound(await getImageById(fileId));

  const optimizedImage = await transformToWebp(file.blob, {
    width,
    height,
    fit,
  });

  const imageBytes = new Uint8Array(optimizedImage);
  const imageFile = new File([imageBytes], fileId, { type: "image/webp" });
  const storedFile = await cache.put(cacheKey, imageFile);

  return createImageResponse(storedFile, fileId);
}
