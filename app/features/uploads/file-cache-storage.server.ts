import { createFsTempStorage } from "~/shared/fs-file-storage.server";

/**
 * Per-process cache for transformed (webp) images, backing the
 * `file.$fileId` resource route. Contents are disposable — a restart simply
 * repopulates the cache on demand.
 */
export const fileStorage = createFsTempStorage();

export function getStorageKey(id: string) {
  return `file-${id}`;
}
