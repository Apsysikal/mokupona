import sharp, { type FitEnum } from "sharp";
import invariant from "tiny-invariant";
import { z } from "zod";

import { prisma } from "~/db.server";
import { logger } from "~/logger.server";
import {
  fileStorage as cache,
  getStorageKey as getCacheKey,
} from "~/utils/file-chache-storage.server";

const SearchParamsSchema = z.object({
  width: z.coerce.number().min(0).optional(),
  height: z.coerce.number().min(0).optional(),
  fit: z.enum(["cover", "contain", "fill"]).optional().default("cover"),
});

type SearchParams = z.infer<typeof SearchParamsSchema>;

type FileRouteLoaderArgs = {
  request: Request;
  params: {
    fileId?: string;
  };
};

export async function loader({ request, params }: FileRouteLoaderArgs) {
  const url = new URL(request.url);
  const searchParams = url.searchParams;
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

  invariant(typeof fileId === "string", "Parameter fileId must be provided");

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

  const file = await prisma.image.findUnique({ where: { id: fileId } });
  if (!file) throw new Response("Not found", { status: 404 });

  const optimizedImage = await sharp(file.blob)
    .webp()
    .resize({
      ...(width && { width: Number(width) }),
      ...(height && { height: Number(height) }),
      fit: isAllowedFit(fit) ? fit : "cover",
    })
    .toBuffer();

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

function isAllowedFit(s: string | null): s is FitEnum[keyof FitEnum] {
  const allowedFits: FitEnum[keyof FitEnum][] = ["contain", "cover", "fill"];
  if (!s) return false;
  // @ts-ignore
  return allowedFits.includes(s);
}
