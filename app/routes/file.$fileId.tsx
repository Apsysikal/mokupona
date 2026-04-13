import sharp, { type FitEnum } from "sharp";
import invariant from "tiny-invariant";
import { z } from "zod";

import { prisma } from "~/db.server";
import {
  fileStorage as cache,
  getStorageKey as getCacheKey,
} from "~/utils/file-chache-storage.server";

const SearchParamsSchema = z.object({
  width: z.coerce.number().int().positive().optional(),
  height: z.coerce.number().int().positive().optional(),
  fit: z.enum(["cover", "contain", "fill"]).optional().default("cover"),
});

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

  if (!options.success) {
    // Params were malformed
    throw new Response("Bad request", {
      status: 400,
    });
  }

  invariant(typeof fileId === "string", "Parameter fileId must be provided");

  const { width, height, fit } = options.data;
  const cacheKey = getCacheKey(`${fileId}-${width}-${height}-${fit}`);

  if (await cache.has(cacheKey)) {
    const fileStream = await cache.get(cacheKey);
    if (!fileStream) {
      // Key exists but no file. Continue as if no cache exists.
    } else {
      return new Response(fileStream.stream(), {
        headers: {
          "Content-Type": "image/webp",
          "Content-Disposition": `inline; filename="${params.fileId}"`,
          "Cache-Control": "public, max-age=31536000, immutable",
        },
      });
    }
  }

  const file = await prisma.image.findUnique({ where: { id: fileId } });
  if (!file) throw new Response("Not found", { status: 404 });

  const optimizedImage = await sharp(file.blob)
    .webp()
    .resize({
      ...(width ? { width } : {}),
      ...(height ? { height } : {}),
      fit: isAllowedFit(fit) ? fit : "cover",
    })
    .toBuffer();

  const optimizedImageBytes = new Uint8Array(optimizedImage);
  const optimizedImageFile = new File([optimizedImageBytes], fileId);

  // @ts-ignore
  return new Response(
    (await cache.put(cacheKey, optimizedImageFile)).stream(),
    {
      headers: {
        "Content-Type": "image/webp",
        "Content-Disposition": `inline; filename="${params.fileId}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}

function isAllowedFit(s: string | null): s is FitEnum[keyof FitEnum] {
  const allowedFits: FitEnum[keyof FitEnum][] = ["contain", "cover", "fill"];
  if (!s) return false;
  // @ts-ignore
  return allowedFits.includes(s);
}
