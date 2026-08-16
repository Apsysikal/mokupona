import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { imageSize } from "image-size";

import type { ImageStorageProvider } from "../types";

import { createFsFolderStorage } from "~/shared/fs-file-storage.server";

const DEFAULT_UPLOAD_FOLDER = join(tmpdir(), "mokupona-image-uploads");

function resolveStorage(env: NodeJS.ProcessEnv) {
  return createFsFolderStorage(
    env.IMAGE_UPLOAD_FOLDER ?? DEFAULT_UPLOAD_FOLDER,
  );
}

// Cloudinary reports intrinsic pixels in its upload response; locally the
// header bytes are the only source. Unreadable bytes just mean no dimensions
// (the UI falls back to a 3:2 frame), never a failed upload.
function measure(bytes: Uint8Array): { width?: number; height?: number } {
  try {
    const { width, height, orientation } = imageSize(bytes);
    // EXIF orientations 5–8 rotate the raster 90°, so display size swaps
    return orientation && orientation >= 5
      ? { width: height, height: width }
      : { width, height };
  } catch {
    return {};
  }
}

export function createLocalProvider(
  env: NodeJS.ProcessEnv = process.env,
): ImageStorageProvider {
  const storage = resolveStorage(env);

  return {
    async store(file, { folder }) {
      const storageKey = `${folder}/${randomUUID()}`;
      await storage.put(storageKey, file);
      return {
        storageKey,
        ...measure(new Uint8Array(await file.arrayBuffer())),
      };
    },
    async destroy(storageKey) {
      await storage.remove(storageKey);
    },
  };
}

export async function getLocalImageFile(
  storageKey: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  return resolveStorage(env).get(storageKey);
}
