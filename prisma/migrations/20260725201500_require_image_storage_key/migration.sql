-- Cloudinary migration, phase 3 follow-up: make `Image.storageKey` required.
--
-- Since `blob` was dropped, the storage key is a row's only link to its bytes,
-- so a keyless row is unrenderable garbage. The only ones left were orphans —
-- rows that lost both owner FKs, from the pre-FK-rework replace flow that
-- abandoned the old row instead of deleting it (38 on prod, 24 on staging,
-- 2 in local dev). The retired `sweep:orphan-images` script used to clear
-- these; nothing has referenced them for a long time.
--
-- The delete is deliberately narrow: orphaned AND keyless. A keyless row that
-- still owns an event or board member would be something new and unexplained,
-- so it survives the delete and fails the rebuild below — the loud failure is
-- the point, not something to guard around.
DELETE FROM "Image"
WHERE "storageKey" IS NULL
  AND "eventId" IS NULL
  AND "boardMemberId" IS NULL;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "altText" TEXT,
    "contentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "version" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "blurDataUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "boardMemberId" TEXT,
    "eventId" TEXT,
    CONSTRAINT "Image_boardMemberId_fkey" FOREIGN KEY ("boardMemberId") REFERENCES "BoardMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Image_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Image" ("altText", "blurDataUrl", "boardMemberId", "contentType", "createdAt", "eventId", "height", "id", "storageKey", "updatedAt", "version", "width") SELECT "altText", "blurDataUrl", "boardMemberId", "contentType", "createdAt", "eventId", "height", "id", "storageKey", "updatedAt", "version", "width" FROM "Image";
DROP TABLE "Image";
ALTER TABLE "new_Image" RENAME TO "Image";
CREATE UNIQUE INDEX "Image_boardMemberId_key" ON "Image"("boardMemberId");
CREATE UNIQUE INDEX "Image_eventId_key" ON "Image"("eventId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
