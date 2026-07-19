import { z } from "zod";

import type { Route } from "./+types/file.$fileId";

import {
  fileStorage as cache,
  getStorageKey as getCacheKey,
} from "~/features/uploads/file-cache-storage.server";
import { logger } from "~/logger.server";
import { getImageById } from "~/models/image.server";
import { requireFound } from "~/shared/http.server";
import { IMAGE_FITS } from "~/shared/image";
import { transformToWebp } from "~/utils/image-transform.server";

// Current responsive variants top out at 1080px. A 2048px ceiling leaves
// room for larger high-density uses without allowing unbounded transforms or
// cache-key proliferation from arbitrary dimensions.
const MAX_IMAGE_DIMENSION = 2048;

const SearchParamsSchema = z.object({
  width: z.coerce.number().int().positive().max(MAX_IMAGE_DIMENSION).optional(),
  height: z.coerce
    .number()
    .int()
    .positive()
    .max(MAX_IMAGE_DIMENSION)
    .optional(),
  fit: z.enum(IMAGE_FITS).optional().default("cover"),
});

function createImageResponse(file: File, fileId: string) {
  return new Response(file, {
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

  logger.info(JSON.stringify(options));

  if (!options.success) {
    // Params were malformed
    throw new Response("Bad request", {
      status: 400,
    });
  }

  const { width, height, fit } = options.data;
  const cacheKey = getCacheKey(`${fileId}-${width}-${height}-${fit}`);

  logger.info(`Checking cache with: ${cacheKey}`);

  const cachedFile = await cache.get(cacheKey);
  if (cachedFile) {
    logger.info(`Cache hit with: ${cacheKey}`);
    return createImageResponse(cachedFile, fileId);
  }
  logger.info(`Cache miss with: ${cacheKey}`);

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
