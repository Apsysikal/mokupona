// Manual-run maintenance script: deletes Image rows that lost both owners
// (no board member, no event) — e.g. leaked by pre-Phase-3 code paths.
// Dry run by default; pass --apply to actually delete.
//
//   npm run sweep:orphan-images            # report the orphan count
//   npm run sweep:orphan-images -- --apply # delete the orphans

import { countOrphanImages, deleteOrphanImages } from "~/models/image.server";

const apply = process.argv.includes("--apply");

async function sweep() {
  const orphans = await countOrphanImages();

  if (!apply) {
    console.log(
      `Dry run: ${orphans} orphan image(s) would be deleted. Pass --apply to delete them.`,
    );
    return;
  }

  const { count } = await deleteOrphanImages();
  console.log(`Deleted ${count} orphan image(s).`);
}

sweep()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    // better-sqlite3 is synchronous; nothing keeps the event loop alive, but
    // exit explicitly so the script never hangs a shell on driver changes.
    process.exit();
  });
