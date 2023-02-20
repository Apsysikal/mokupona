-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "subtitle" TEXT NOT NULL,
    "tags" TEXT NOT NULL,
    "slots" INTEGER NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "signupDate" DATETIME NOT NULL,
    "price" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "locationId" TEXT NOT NULL,
    CONSTRAINT "Event_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("date", "description", "id", "imageUrl", "locationId", "price", "shortDescription", "signupDate", "slots", "subtitle", "tags", "title") SELECT "date", "description", "id", "imageUrl", "locationId", "price", "shortDescription", "signupDate", "slots", "subtitle", "tags", "title" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
