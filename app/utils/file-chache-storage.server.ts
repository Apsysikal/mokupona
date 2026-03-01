import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { sep } from "node:path";

import { createFsFileStorage } from "@remix-run/file-storage/fs";

const tmpDir = tmpdir();
const tmpPath = mkdtempSync(`${tmpDir}${sep}`);

export const fileStorage = createFsFileStorage(tmpPath);

export function getStorageKey(id: string) {
  return `file-${id}`;
}
