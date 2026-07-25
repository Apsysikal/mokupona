import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { sep } from "node:path";

import { createFsFileStorage } from "@remix-run/file-storage/fs";

/**
 * Create a filesystem-backed `FileStorage` rooted at a fresh per-process temp
 * directory. Key naming stays with the caller — this primitive knows nothing
 * about what is stored in it.
 */
export function createFsTempStorage() {
  return createFsFileStorage(mkdtempSync(`${tmpdir()}${sep}`));
}

/**
 * Create a filesystem-backed `FileStorage` rooted at a persistent directory,
 * created on demand. Unlike the temp variant the directory survives the
 * process and is shared by every process pointing at the same path (the seed
 * and e2e helper scripts write files the dev server must serve).
 */
export function createFsFolderStorage(directory: string) {
  mkdirSync(directory, { recursive: true });
  return createFsFileStorage(directory);
}
