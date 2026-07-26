import { mkdirSync } from "node:fs";

import { createFsFileStorage } from "@remix-run/file-storage/fs";

/**
 * Create a filesystem-backed `FileStorage` rooted at a persistent directory,
 * created on demand. The directory survives the process and is shared by
 * every process pointing at the same path (the seed and e2e helper scripts
 * write files the dev server must serve).
 */
export function createFsFolderStorage(directory: string) {
  mkdirSync(directory, { recursive: true });
  return createFsFileStorage(directory);
}
