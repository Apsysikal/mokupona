-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EventResponse" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "vegetarian" BOOLEAN,
    "student" BOOLEAN,
    "restrictions" TEXT,
    "comment" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "eventId" TEXT NOT NULL,
    CONSTRAINT "EventResponse_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_EventResponse" ("comment", "createdAt", "email", "eventId", "id", "name", "restrictions", "student", "updatedAt", "vegetarian") SELECT "comment", "createdAt", "email", "eventId", "id", "name", "restrictions", "student", "updatedAt", "vegetarian" FROM "EventResponse";
DROP TABLE "EventResponse";
ALTER TABLE "new_EventResponse" RENAME TO "EventResponse";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
