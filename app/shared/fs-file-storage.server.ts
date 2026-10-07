import { mkdirSync } from "node:fs";

import { createFsFileStorage } from "@remix-run/file-storage/fs";

export function createFsFolderStorage(directory: string) {
  mkdirSync(directory, { recursive: true });
  return createFsFileStorage(directory);
}
