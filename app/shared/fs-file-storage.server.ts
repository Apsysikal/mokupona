import { mkdtempSync } from "node:fs";
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
