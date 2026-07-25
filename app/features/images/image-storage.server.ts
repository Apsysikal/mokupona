import { createCloudinaryProvider } from "./providers/cloudinary.server";
import { createLocalProvider } from "./providers/local.server";
import type { ImageStorageProvider, StoredImage } from "./types";

import { logger } from "~/logger.server";
import { singleton } from "~/utils/singleton.server";

/** The asset folders this app writes to, per owner entity. */
export type ImageFolder = "dinners" | "board-members";

// Exported for tests; the app goes through the singleton below so an invalid
// configuration fails on first import, not on first upload.
export function createImageStorageProvider(
  env: NodeJS.ProcessEnv = process.env,
): ImageStorageProvider {
  const name = env.IMAGE_PROVIDER ?? "local";
  switch (name) {
    case "local":
      return createLocalProvider(env);
    case "cloudinary":
      // the factory invariants the CLOUDINARY_* variables
      return createCloudinaryProvider(env);
    default:
      throw new Error(
        `Unknown IMAGE_PROVIDER "${name}" — expected "cloudinary" or "local"`,
      );
  }
}

const provider = singleton("image-storage-provider", () =>
  createImageStorageProvider(),
);

/** Persist an upload with the configured provider (design §3: upload flow). */
export function storeImage(
  file: File,
  folder: ImageFolder,
): Promise<StoredImage> {
  return provider.store(file, { folder });
}

/**
 * Destroy the provider assets behind storage keys a model captured in its
 * transaction (design §3.4). Runs strictly AFTER the DB commit; a destroy
 * failure is logged, never rethrown — a leaked asset is acceptable, failing
 * the user's already-committed action is not. Nulls (the owner had no image
 * to begin with) are skipped.
 */
export async function destroyImages(
  storageKeys: (string | null | undefined)[],
  providerOverride: ImageStorageProvider = provider,
): Promise<void> {
  for (const storageKey of storageKeys) {
    if (!storageKey) continue;
    try {
      await providerOverride.destroy(storageKey);
    } catch (error) {
      logger.warn("Failed to destroy stored image after DB commit", {
        storageKey,
        error,
      });
    }
  }
}
