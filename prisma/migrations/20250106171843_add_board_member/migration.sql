-- CreateTable
CREATE TABLE "BoardMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EventImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "altText" TEXT,
    "contentType" TEXT NOT NULL,
    "blob" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "boardMemberId" TEXT,
    CONSTRAINT "EventImage_boardMemberId_fkey" FOREIGN KEY ("boardMemberId") REFERENCES "BoardMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EventImage" ("altText", "blob", "contentType", "createdAt", "id", "updatedAt") SELECT "altText", "blob", "contentType", "createdAt", "id", "updatedAt" FROM "EventImage";
DROP TABLE "EventImage";
ALTER TABLE "new_EventImage" RENAME TO "EventImage";
CREATE UNIQUE INDEX "EventImage_boardMemberId_key" ON "EventImage"("boardMemberId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
