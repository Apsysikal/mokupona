import { requestLogger } from "~/logger/request-context.server";

const BLUR_TRANSFORM = "w_100,q_auto,f_webp,e_blur:1000";

export function buildBlurVariantUrl(
  cloudName: string,
  publicId: string,
  version?: number,
) {
  const versionSegment = version === undefined ? "" : `v${version}/`;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${BLUR_TRANSFORM}/${versionSegment}${publicId}`;
}

/**
 * Fetch the blurred variant and encode it as a base64 data URL (~1–2 KB).
 * Returns null on any failure — a missing placeholder degrades to the neutral
 * background, it must never fail the upload that triggered it.
 */
export async function fetchBlurDataUrl({
  cloudName,
  publicId,
  version,
}: {
  cloudName: string;
  publicId: string;
  version?: number;
}): Promise<string | null> {
  try {
    const response = await fetch(
      buildBlurVariantUrl(cloudName, publicId, version),
    );
    if (!response.ok) return null;

    const bytes = Buffer.from(await response.arrayBuffer());
    return `data:image/webp;base64,${bytes.toString("base64")}`;
  } catch (error) {
    // getBlurDataUrl caches this promise for the process lifetime, so a single
    // failure here degrades the landing page until the next deploy
    requestLogger().warn(
      { storageKey: publicId, error },
      "Blur placeholder fetch failed",
    );
    return null;
  }
}

// Static hero/accent assets have no Image row to persist a placeholder on;
// cache per public_id for the lifetime of the process (one fetch per boot).
const staticBlurCache = new Map<string, Promise<string | null>>();

export function getBlurDataUrl(
  publicId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<string | null> {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName) return Promise.resolve(null);

  let cached = staticBlurCache.get(publicId);
  if (!cached) {
    cached = fetchBlurDataUrl({ cloudName, publicId });
    staticBlurCache.set(publicId, cached);
  }
  return cached;
}
