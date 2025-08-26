import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { sep } from "node:path";

import { LocalFileStorage } from "@remix-run/file-storage/local";

const tmpDir = tmpdir();
const tmpPath = mkdtempSync(`${tmpDir}${sep}`);

export const fileStorage = new LocalFileStorage(tmpPath);

export function getStorageKey(id: string) {
  return `file-${id}`;
}
