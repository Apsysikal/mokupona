/*
  Warnings:

  - You are about to drop the column `messenger` on the `EventResponse` table. All the data in the column will be lost.
  - You are about to drop the column `phoneNumber` on the `EventResponse` table. All the data in the column will be lost.
  - Added the required column `email` to the `EventResponse` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EventResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "vegetarian" BOOLEAN NOT NULL DEFAULT false,
    "vegan" BOOLEAN NOT NULL DEFAULT false,
    "noNuts" BOOLEAN NOT NULL DEFAULT false,
    "noDairy" BOOLEAN NOT NULL DEFAULT false,
    "noAlcohol" BOOLEAN NOT NULL DEFAULT false,
    "comment" TEXT,
    "termsOfService" BOOLEAN NOT NULL,
    "newsletter" BOOLEAN NOT NULL DEFAULT false,
    "eventId" TEXT NOT NULL,
    CONSTRAINT "EventResponse_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EventResponse" ("comment", "eventId", "id", "name", "newsletter", "noAlcohol", "noDairy", "noNuts", "termsOfService", "vegan", "vegetarian") SELECT "comment", "eventId", "id", "name", "newsletter", "noAlcohol", "noDairy", "noNuts", "termsOfService", "vegan", "vegetarian" FROM "EventResponse";
DROP TABLE "EventResponse";
ALTER TABLE "new_EventResponse" RENAME TO "EventResponse";
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "slots" INTEGER NOT NULL DEFAULT 16,
    "imageUrl" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    CONSTRAINT "Event_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("date", "description", "id", "imageUrl", "locationId", "price", "shortDescription", "subtitle", "tags", "title") SELECT "date", "description", "id", "imageUrl", "locationId", "price", "shortDescription", "subtitle", "tags", "title" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
