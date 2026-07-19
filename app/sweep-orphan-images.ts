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

// No explicit process.exit(): it does not wait for piped stdout and can
// swallow the report line under npm/CI. better-sqlite3 is synchronous and
// holds no open handles, so the event loop drains on its own; should a
// future driver change make this hang, disconnect the client through a
// model helper instead of exiting.
sweep().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
