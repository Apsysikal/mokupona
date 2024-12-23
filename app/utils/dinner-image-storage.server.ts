import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { sep } from "node:path";

import { LocalFileStorage } from "@mjackson/file-storage/local";

const tmpDir = tmpdir();
const tmpPath = mkdtempSync(`${tmpDir}${sep}`);

export const fileStorage = new LocalFileStorage(
  process.env.IMAGE_UPLOAD_FOLDER || tmpPath,
);

export function getStorageKey(id: string) {
  return `dinner-${id}-cover`;
}
