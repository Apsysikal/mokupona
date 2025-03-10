import { LazyFile } from "@mjackson/lazy-file";
import type { ComponentProps } from "react";
import sharp, { type FitEnum } from "sharp";
import invariant from "tiny-invariant";
import { z } from "zod";

import type { Route } from "./+types/file.$fileId";

import { prisma } from "~/db.server";
import { logger } from "~/logger.server";
import {
  fileStorage as cache,
  getStorageKey as getCacheKey,
} from "~/utils/file-chache-storage.server";
import { getImageUrl } from "~/utils/misc";

const SearchParamsSchema = z.object({
  width: z.coerce.number().min(0).optional(),
  height: z.coerce.number().min(0).optional(),
  fit: z.enum(["cover", "contain", "fill"]).optional().default("cover"),
});

type SearchParams = z.infer<typeof SearchParamsSchema>;

type ImageInputProps = {
  imageId: string;
  width: number;
  height: number;
} & Partial<Pick<SearchParams, "fit">>;

type ImageProps = Omit<ComponentProps<"img">, "width" | "height" | "src"> &
  ImageInputProps;

export function OptimizedImage({
  imageId,
  width,
  height,
  fit = "cover",
  ...props
}: ImageProps) {
  const breakPoints = [432, 648, 864, 1080];
  const imageUrl = getImageUrl(imageId);
  const aspect = width / height;

  const searchParams = new URLSearchParams({
    w: `${width}`,
    h: `${height}`,
    fit,
  });

  const srcSetUrls = breakPoints.map((w) => {
    const h = w / aspect;
    const searchParams = new URLSearchParams({
      w: `${w}`,
      h: `${h}`,
      fit,
    });

    return `${imageUrl + "?" + searchParams.toString()} ${w}w`;
  });

  return (
    <picture>
      <img
        srcSet={srcSetUrls.join(", ")}
        src={imageUrl + "?" + searchParams.toString()}
        width={width}
        height={height}
        {...props}
      />
    </picture>
  );
}

export async function loader({ request, params }: Route.LoaderArgs) {
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

  const optimizedImage = sharp(file.blob)
    .webp()
    .resize({
      ...(width && { width: Number(width) }),
      ...(height && { height: Number(height) }),
      fit: isAllowedFit(fit) ? fit : "cover",
    });

  const imageStream = new ReadableStream({
    start(controller) {
      optimizedImage.on("data", (chunk) => controller.enqueue(chunk));
      optimizedImage.on("end", () => {
        controller.close();
      });
    },
  });

  // Filesize of the optimized image is unknown
  const lazyFile = new LazyFile(
    {
      byteLength: 0,
      stream() {
        return imageStream;
      },
    },
    fileId,
  );

  return new Response(await cache.put(cacheKey, lazyFile), {
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
