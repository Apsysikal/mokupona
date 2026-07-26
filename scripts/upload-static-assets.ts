/**
 * Seed the landing page's static marketing images into a Cloudinary account
 * under their fixed public_ids. Idempotent (`overwrite: false`), so a re-run
 * against an account that already holds them is a no-op.
 *
 *   npx tsx scripts/upload-static-assets.ts
 *
 * Needed when bootstrapping a fresh Cloudinary account (a new environment),
 * or after replacing one of the `public/*-original.*` source files. Requires
 * CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET.
 *
 * Split out of the phase-2 blob backfill (retired in phase 3 once `Image.blob`
 * was dropped) — this was its only part that is not a one-shot.
 */
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
    // the deployed image ships build/client (Vite's copy of public/), not
    // public/ itself; the assets already exist in the account either way
    // (overwrite: false), so a missing file is a skip, not a failure
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
