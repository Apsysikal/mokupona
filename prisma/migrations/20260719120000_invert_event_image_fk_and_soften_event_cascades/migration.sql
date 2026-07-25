-- Foreign-key rework: supporting entities must never take an event with them.
--  * Event <-> Image inverted: the cover FK moves onto Image (eventId,
--    Cascade) like BoardMember portraits — deleting an event removes its
--    cover; deleting an image leaves the event standing (UI falls back).
--  * Event.addressId: Cascade -> Restrict — an address in use cannot be
--    deleted out from under its events.
--  * Event.createdById: nullable, Cascade -> SetNull — events outlive their
--    creator; authorship is metadata, not ownership.
-- Image must be rebuilt FIRST: eventId backfills from Event.imageId, which
-- the Event rebuild below drops.

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Image" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "altText" TEXT,
    "contentType" TEXT NOT NULL,
    "blob" BLOB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "boardMemberId" TEXT,
    "eventId" TEXT,
    CONSTRAINT "Image_boardMemberId_fkey" FOREIGN KEY ("boardMemberId") REFERENCES "BoardMember" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Image_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Image" ("id", "altText", "contentType", "blob", "createdAt", "updatedAt", "boardMemberId", "eventId")
SELECT
    i."id",
    i."altText",
    i."contentType",
    i."blob",
    i."createdAt",
    i."updatedAt",
    i."boardMemberId",
    e."id"
FROM "Image" i
LEFT JOIN "Event" e ON e."imageId" = i."id";
DROP TABLE "Image";
ALTER TABLE "new_Image" RENAME TO "Image";
CREATE UNIQUE INDEX "Image_boardMemberId_key" ON "Image"("boardMemberId");
CREATE UNIQUE INDEX "Image_eventId_key" ON "Image"("eventId");

CREATE TABLE "new_Event" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "menuDescription" TEXT,
    "donationDescription" TEXT,
    "date" DATETIME NOT NULL,
    "slots" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "discounts" TEXT,
    "addressId" TEXT NOT NULL,
    "createdById" TEXT,
    "formId" TEXT NOT NULL,
    CONSTRAINT "Event_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("id", "title", "description", "menuDescription", "donationDescription", "date", "slots", "price", "discounts", "addressId", "createdById", "formId")
SELECT
    "id",
    "title",
    "description",
    "menuDescription",
    "donationDescription",
    "date",
    "slots",
    "price",
    "discounts",
    "addressId",
    "createdById",
    "formId"
FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_formId_key" ON "Event"("formId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
