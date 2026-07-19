/**
 * One-time (idempotent, resumable) backfill of legacy blob images to
 * Cloudinary — design §6. Run on the Fly VM, staging first:
 *
 *   fly ssh console [-a <staging-app>]
 *   npx tsx scripts/backfill-images-to-cloudinary.ts
 *
 * Requires CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET/FOLDER_PREFIX. Rows that
 * already have a storageKey are skipped, so re-runs only pick up what a
 * previous (crashed) run missed. Also uploads the repo's static hero/accent
 * originals under fixed public_ids (`overwrite: false` → re-run no-ops).
 */
import "dotenv/config";

import { readFile } from "node:fs/promises";
import path from "node:path";

import { prisma } from "~/db.server";
import {
  createCloudinaryProvider,
  uploadStaticAsset,
} from "~/features/images/providers/cloudinary.server";

const STATIC_ASSETS = [
  { publicId: "static/hero-image", file: "public/hero-image-original.jpg" },
  { publicId: "static/accent-image", file: "public/accent-image-original.png" },
];

async function backfillRows() {
  const provider = createCloudinaryProvider();

  const rows = await prisma.image.findMany({
    where: { storageKey: null },
    select: {
      id: true,
      contentType: true,
      blob: true,
      eventId: true,
      boardMemberId: true,
    },
  });

  console.log(`${rows.length} image row(s) without a storageKey`);

  let uploaded = 0;
  for (const row of rows) {
    // owner FK → asset folder; post-FK-rework rows always have exactly one
    const folder = row.eventId
      ? ("dinners" as const)
      : row.boardMemberId
        ? ("board-members" as const)
        : null;

    if (!folder || !row.blob) {
      console.log(
        `- ${row.id}: skipped (${!row.blob ? "no blob" : "no owner"})`,
      );
      continue;
    }

    const file = new File([row.blob], row.id, { type: row.contentType });
    const stored = await provider.store(file, { folder });

    // blob stays untouched — it is the phase 1-2 rollback safety net
    await prisma.image.update({ where: { id: row.id }, data: stored });

    uploaded += 1;
    console.log(`- ${row.id}: ${stored.storageKey} (${folder})`);
  }

  console.log(`Backfilled ${uploaded}/${rows.length} row(s).`);
}

async function uploadStaticAssets() {
  for (const asset of STATIC_ASSETS) {
    const bytes = await readFile(path.resolve(process.cwd(), asset.file));
    await uploadStaticAsset(bytes, asset.publicId);
    console.log(`- static: ${asset.publicId} (overwrite: false)`);
  }
}

async function main() {
  await backfillRows();
  await uploadStaticAssets();
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
