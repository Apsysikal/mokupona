/*
  Warnings:

  - You are about to drop the column `cover` on the `Event` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "slots" INTEGER NOT NULL,
    "price" DECIMAL NOT NULL,
    "imageId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "Event_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "EventImage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("addressId", "createdById", "date", "description", "id", "imageId", "price", "slots", "title") SELECT "addressId", "createdById", "date", "description", "id", "imageId", "price", "slots", "title" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_imageId_key" ON "Event"("imageId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
