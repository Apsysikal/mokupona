import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { sep } from "node:path";

import { createFsFileStorage } from "@remix-run/file-storage/fs";

const tmpDir = tmpdir();
const tmpPath = mkdtempSync(`${tmpDir}${sep}`);

export const fileStorage = createFsFileStorage(
  process.env.IMAGE_UPLOAD_FOLDER || tmpPath,
);

export function getStorageKey(id: string) {
  return `dinner-${id}-cover`;
}
