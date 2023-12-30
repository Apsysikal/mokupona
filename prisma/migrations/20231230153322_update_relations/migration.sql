/*
  Warnings:

  - Added the required column `createdById` to the `Event` table without a default value. This is not possible if the table is not empty.

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
    "cover" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    CONSTRAINT "Event_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("addressId", "cover", "date", "description", "id", "price", "slots", "title") SELECT "addressId", "cover", "date", "description", "id", "price", "slots", "title" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE TABLE "new_EventResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "eventId" TEXT NOT NULL,
    CONSTRAINT "EventResponse_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EventResponse" ("createdAt", "email", "eventId", "id", "name", "updatedAt") SELECT "createdAt", "email", "eventId", "id", "name", "updatedAt" FROM "EventResponse";
DROP TABLE "EventResponse";
ALTER TABLE "new_EventResponse" RENAME TO "EventResponse";
CREATE UNIQUE INDEX "EventResponse_email_eventId_key" ON "EventResponse"("email", "eventId");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
