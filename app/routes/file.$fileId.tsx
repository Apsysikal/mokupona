import { redirect } from "react-router";

import type { Route } from "./+types/file.$fileId";

import { getLocalImageFile } from "~/features/images/providers/local.server";
import { getImageById } from "~/models/image.server";
import { requireFound } from "~/shared/http.server";
import { getImageUrl, type ImageProviderConfig } from "~/shared/image";

// Thin serving/redirect route since the Cloudinary migration. Transforms
// happen on the CDN; this route only ever hands out original bytes:
//
// - cloudinary provider → 302 to the delivery URL (legacy links out in the
//   wild: OG scrapers, cached pages)
// - local provider → stream the stored file from disk
//
// Old transform query params (w/h/fit) are ignored. The route stays off the
// lazy user context — keep it auth-cost-free.

function imageConfigFromEnv(): ImageProviderConfig {
  return {
    imageProvider:
      process.env.IMAGE_PROVIDER === "cloudinary" ? "cloudinary" : "local",
    cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME ?? null,
  };
}

// Streaming keeps image bytes out of memory; LazyFile (fs storage) no longer
// implements File, so responses are built from the stream + size metadata.
function createImageResponse(
  body: BodyInit,
  {
    contentType,
    size,
    fileId,
  }: { contentType: string; size: number; fileId: string },
) {
  return new Response(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `inline; filename="${fileId}"`,
      "Content-Length": String(size),
      // replaced covers get fresh row ids, rows never mutate — safe to pin
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function loader({ params }: Route.LoaderArgs) {
  const { fileId } = params;

  const image = requireFound(await getImageById(fileId));
  const config = imageConfigFromEnv();
  const storageKey = requireFound(image.storageKey);

  if (config.imageProvider === "cloudinary" && config.cloudinaryCloudName) {
    return redirect(getImageUrl(image, config), 302);
  }

  // 404 rather than a stale body when the row points at a file this provider
  // does not hold (e.g. a cloudinary-stored row read back under `local`).
  const file = requireFound(await getLocalImageFile(storageKey));
  return createImageResponse(file.stream(), {
    contentType: image.contentType,
    size: file.size,
    fileId,
  });
}
