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
import { getLocalImageFile } from "~/features/images/providers/local.server";
import type { ImageStorageProvider } from "~/features/images/types";

const STATIC_ASSETS = [
  { publicId: "static/hero-image", file: "public/hero-image-original.jpg" },
  { publicId: "static/accent-image", file: "public/accent-image-original.png" },
];

function folderForRow(row: {
  eventId: string | null;
  boardMemberId: string | null;
}) {
  // owner FK → asset folder; post-FK-rework rows always have exactly one
  return row.eventId
    ? ("dinners" as const)
    : row.boardMemberId
      ? ("board-members" as const)
      : null;
}

async function backfillBlobRows(provider: ImageStorageProvider) {
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
    const folder = folderForRow(row);

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

  console.log(`Backfilled ${uploaded}/${rows.length} blob row(s).`);
}

/**
 * Uploads made while IMAGE_PROVIDER was still local (the phase 1→2 window)
 * have a local storageKey, no version and no blob; their bytes live under
 * IMAGE_UPLOAD_FOLDER (volume-backed on Fly). Move them to Cloudinary too —
 * cloudinary-stored rows always carry a version, so `version: null` is the
 * local marker and re-runs skip migrated rows (idempotent).
 */
async function backfillLocalStoredRows(provider: ImageStorageProvider) {
  const rows = await prisma.image.findMany({
    where: { storageKey: { not: null }, version: null },
    select: {
      id: true,
      contentType: true,
      storageKey: true,
      eventId: true,
      boardMemberId: true,
    },
  });

  console.log(`${rows.length} locally stored row(s) from the cutover window`);

  for (const row of rows) {
    const folder = folderForRow(row);
    const file = row.storageKey && (await getLocalImageFile(row.storageKey));

    if (!folder || !file) {
      console.log(
        `- ${row.id}: skipped (${!folder ? "no owner" : "local file missing"})`,
      );
      continue;
    }

    const bytes = await new Response(file.stream()).arrayBuffer();
    const stored = await provider.store(
      new File([bytes], row.id, { type: row.contentType }),
      { folder },
    );

    // the local file is left behind on the volume — harmless, and keeping it
    // preserves the rollback path until phase 3
    await prisma.image.update({ where: { id: row.id }, data: stored });
    console.log(`- ${row.id}: ${row.storageKey} -> ${stored.storageKey}`);
  }
}

async function uploadStaticAssets() {
  for (const asset of STATIC_ASSETS) {
    const bytes = await readFile(path.resolve(process.cwd(), asset.file));
    await uploadStaticAsset(bytes, asset.publicId);
    console.log(`- static: ${asset.publicId} (overwrite: false)`);
  }
}

async function main() {
  const provider = createCloudinaryProvider();

  await backfillBlobRows(provider);
  await backfillLocalStoredRows(provider);
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
