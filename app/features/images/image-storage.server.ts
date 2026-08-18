import { createCloudinaryProvider } from "./providers/cloudinary.server";
import { createLocalProvider } from "./providers/local.server";
import type { ImageStorageProvider, StoredImage } from "./types";

import { requestLogger } from "~/logger/request-context.server";
import { logger } from "~/logger.server";
import { singleton } from "~/utils/singleton.server";

/** The asset folders this app writes to, per owner entity. */
export type ImageFolder = "dinners" | "board-members" | "dinner-gallery";

function imageProviderName(env: NodeJS.ProcessEnv) {
  return env.IMAGE_PROVIDER ?? "local";
}

export function createImageStorageProvider(
  env: NodeJS.ProcessEnv = process.env,
): ImageStorageProvider {
  const name = imageProviderName(env);
  switch (name) {
    case "local":
      return createLocalProvider(env);
    case "cloudinary":
      return createCloudinaryProvider(env);
    default:
      throw new Error(
        `Unknown IMAGE_PROVIDER "${name}" — expected "cloudinary" or "local"`,
      );
  }
}

const provider = singleton("image-storage-provider", () => {
  const instance = createImageStorageProvider();
  logger.info(
    {
      provider: imageProviderName(process.env),
      folderPrefix: process.env.CLOUDINARY_FOLDER_PREFIX,
    },
    "image storage provider selected",
  );
  return instance;
});

export function storeImage(
  file: File,
  folder: ImageFolder,
): Promise<StoredImage> {
  return provider.store(file, { folder });
}

const STORE_CONCURRENCY = 4;

/**
 * Store a batch, settled and in input order: one file's failure never discards
 * the assets its siblings already put on the provider. Runs a few at a time so
 * a full gallery submission does not open twelve uploads at once.
 */
export async function storeImages(
  files: File[],
  folder: ImageFolder,
  providerOverride: ImageStorageProvider = provider,
): Promise<PromiseSettledResult<StoredImage>[]> {
  const results = new Array<PromiseSettledResult<StoredImage>>(files.length);
  let next = 0;

  async function worker() {
    while (next < files.length) {
      const index = next++;
      try {
        results[index] = {
          status: "fulfilled",
          value: await providerOverride.store(files[index], { folder }),
        };
      } catch (error) {
        requestLogger.warn(
          { folder, fileName: files[index].name, error },
          "Failed to store image",
        );
        results[index] = { status: "rejected", reason: error };
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(STORE_CONCURRENCY, files.length) }, worker),
  );

  return results;
}

export async function destroyImages(
  storageKeys: (string | null | undefined)[],
  providerOverride: ImageStorageProvider = provider,
): Promise<void> {
  for (const storageKey of storageKeys) {
    if (!storageKey) continue;
    try {
      await providerOverride.destroy(storageKey);
    } catch (error) {
      requestLogger.warn(
        {
          storageKey,
          error,
        },
        "Failed to destroy stored image after DB commit",
      );
    }
  }
}
