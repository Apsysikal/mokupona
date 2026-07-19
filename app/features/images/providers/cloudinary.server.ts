import { v2 as cloudinary } from "cloudinary";
import type { UploadApiOptions, UploadApiResponse } from "cloudinary";
import invariant from "tiny-invariant";

import { fetchBlurDataUrl } from "../blur-placeholder.server";
import type { ImageStorageProvider } from "../types";

// The only module that may import the Cloudinary SDK (design §3.1).

function uploadStream(
  buffer: Buffer,
  options: UploadApiOptions,
): Promise<UploadApiResponse> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      options,
      (error, result) =>
        result ? resolve(result) : reject(error ?? new Error("Upload failed")),
    );
    stream.end(buffer);
  });
}

export function createCloudinaryProvider(
  env: NodeJS.ProcessEnv = process.env,
): ImageStorageProvider {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;
  // the env's folder prefix is the only namespace this app may write to
  const folderPrefix = env.CLOUDINARY_FOLDER_PREFIX;

  invariant(
    cloudName && apiKey && apiSecret && folderPrefix,
    'CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET and CLOUDINARY_FOLDER_PREFIX must be set when IMAGE_PROVIDER="cloudinary"',
  );

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  return {
    async store(file, { folder }) {
      const buffer = Buffer.from(await file.arrayBuffer());
      // dynamic folder mode: asset_folder organizes, public_id stays decoupled
      const result = await uploadStream(buffer, {
        resource_type: "image",
        asset_folder: `${folderPrefix}/${folder}`,
      });

      // generated once here, persisted on the Image row; null (a fetch
      // hiccup) degrades to the neutral placeholder, never fails the upload
      const blurDataUrl = await fetchBlurDataUrl({
        cloudName,
        publicId: result.public_id,
        version: result.version,
      });

      return {
        storageKey: result.public_id,
        version: result.version,
        width: result.width,
        height: result.height,
        blurDataUrl: blurDataUrl ?? undefined,
      };
    },
    async destroy(storageKey) {
      await cloudinary.uploader.destroy(storageKey, { invalidate: true });
    },
  };
}

/**
 * Backfill-only: upload a repo static asset under a fixed public_id in the
 * shared (non-env-prefixed) static/ folder. `overwrite: false` makes re-runs
 * no-ops. Lives here so the SDK stays confined to this providers module.
 */
export async function uploadStaticAsset(
  bytes: Uint8Array,
  publicId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const cloudName = env.CLOUDINARY_CLOUD_NAME;
  const apiKey = env.CLOUDINARY_API_KEY;
  const apiSecret = env.CLOUDINARY_API_SECRET;

  invariant(
    cloudName && apiKey && apiSecret,
    "CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET must be set to upload static assets",
  );

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  });

  await uploadStream(Buffer.from(bytes), {
    resource_type: "image",
    public_id: publicId,
    overwrite: false,
    asset_folder: "static",
  });
}
