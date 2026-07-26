import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ImageStorageProvider } from "../types";

import { createFsFolderStorage } from "~/shared/fs-file-storage.server";

// A stable path (not a per-process mkdtemp): the seed and the e2e helper
// scripts store files in separate processes from the server that serves them.
const DEFAULT_UPLOAD_FOLDER = join(tmpdir(), "mokupona-image-uploads");

function resolveStorage(env: NodeJS.ProcessEnv) {
  return createFsFolderStorage(
    env.IMAGE_UPLOAD_FOLDER ?? DEFAULT_UPLOAD_FOLDER,
  );
}

export function createLocalProvider(
  env: NodeJS.ProcessEnv = process.env,
): ImageStorageProvider {
  const storage = resolveStorage(env);

  return {
    async store(file, { folder }) {
      // the storage key is generated here, not derived from the Image row —
      // store() runs before the row exists (the model persists its result)
      const storageKey = `${folder}/${randomUUID()}`;
      await storage.put(storageKey, file);
      return { storageKey };
    },
    async destroy(storageKey) {
      await storage.remove(storageKey);
    },
  };
}

/**
 * Read side for the `/file/:fileId` route: the file behind a local
 * `storageKey`, or null when it does not exist (e.g. a cloudinary-stored row
 * during a provider rollback — the route falls back to the legacy blob).
 */
export async function getLocalImageFile(
  storageKey: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  return resolveStorage(env).get(storageKey);
}
