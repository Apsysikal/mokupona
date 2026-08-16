import { randomUUID } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import type { ImageStorageProvider } from "../types";

import { createFsFolderStorage } from "~/shared/fs-file-storage.server";

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
      const storageKey = `${folder}/${randomUUID()}`;
      await storage.put(storageKey, file);
      return { storageKey };
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
