import { z } from "zod";

import type { Route } from "./+types/file.$fileId";

import { IMAGE_FITS } from "~/components/optimized-image";
import { logger } from "~/logger.server";
import { getImageById } from "~/models/image.server";
import { requireFound } from "~/shared/http.server";
import {
  fileStorage as cache,
  getStorageKey as getCacheKey,
} from "~/utils/file-chache-storage.server";
import { transformToWebp } from "~/utils/image-transform.server";

const SearchParamsSchema = z.object({
  width: z.coerce.number().min(0).optional(),
  height: z.coerce.number().min(0).optional(),
  fit: z.enum(IMAGE_FITS).optional().default("cover"),
});

export async function loader({ url, params }: Route.LoaderArgs) {
  const searchParams = new URL(url).searchParams;
  const { fileId } = params;

  const options = SearchParamsSchema.safeParse({
    width: searchParams.get("w"),
    height: searchParams.get("h"),
    fit: searchParams.get("fit"),
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

  if (await cache.has(cacheKey)) {
    const fileStream = await cache.get(cacheKey);
    if (!fileStream) {
      // Key exists but no file.
      // Continue as if no cache exists
      logger.info(`Cache miss with: ${cacheKey}`);
    } else {
      // Cache hit successful
      logger.info(`Cache hit with: ${cacheKey}`);
      return new Response(fileStream.stream(), {
        headers: {
          "Content-Type": "image/webp",
          "Content-Disposition": `inline; filename="${params.fileId}"`,
          "Cache-Control": "public, max-age=31536000, immutable",
          "Transfer-Encoding": "chunked",
        },
      });
    }
  } else {
    logger.info(`Cache miss with: ${cacheKey}`);
  }

  const file = requireFound(await getImageById(fileId));

  const optimizedImage = await transformToWebp(file.blob, {
    width,
    height,
    fit,
  });

  const test = new Uint8Array(optimizedImage);
  const testFile = new File([test], fileId);

  // @ts-ignore
  return new Response((await cache.put(cacheKey, testFile)).stream(), {
    headers: {
      "Content-Type": "image/webp",
      "Content-Disposition": `inline; filename="${params.fileId}"`,
      "Cache-Control": "public, max-age=31536000, immutable",
      "Transfer-Encoding": "chunked",
    },
  });
}
