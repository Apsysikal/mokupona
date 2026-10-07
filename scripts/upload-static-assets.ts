import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { uploadStaticAsset } from "~/features/images/providers/cloudinary.server";

const STATIC_ASSETS = [
  { publicId: "static/hero-image", file: "public/hero-image-original.jpg" },
  { publicId: "static/accent-image", file: "public/accent-image-original.png" },
];

async function readFirstExisting(candidates: string[]) {
  for (const candidate of candidates) {
    try {
      return await readFile(path.resolve(process.cwd(), candidate));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return null;
}

async function main() {
  for (const asset of STATIC_ASSETS) {
    const bytes = await readFirstExisting([
      asset.file,
      path.join("build/client", path.basename(asset.file)),
    ]);

    if (!bytes) {
      console.log(`- ${asset.publicId}: skipped (file not on disk)`);
      continue;
    }

    await uploadStaticAsset(bytes, asset.publicId);
    console.log(`- ${asset.publicId}: uploaded (overwrite: false)`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
