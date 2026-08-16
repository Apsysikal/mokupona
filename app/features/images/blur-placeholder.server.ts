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
    requestLogger.warn(
      { storageKey: publicId, error },
      "Blur placeholder fetch failed",
    );
    return null;
  }
}

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
