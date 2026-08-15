-- Image becomes a pure asset primitive: the owner FKs move off Image onto the
-- slots that show it (Event.imageId / BoardMember.imageId, SetNull — deleting
-- an image leaves its owner standing), and gallery membership arrives as the
-- EventGalleryImage join table.
-- Image must be rebuilt LAST: Event.imageId / BoardMember.imageId backfill
-- from the old owner columns the Image rebuild drops.

-- CreateTable
CREATE TABLE "EventGalleryImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caption" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "eventId" TEXT NOT NULL,
    "imageId" TEXT NOT NULL,
    CONSTRAINT "EventGalleryImage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EventGalleryImage_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BoardMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "imageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BoardMember_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BoardMember" ("createdAt", "id", "name", "position", "updatedAt", "imageId")
SELECT
    "createdAt",
    "id",
    "name",
    "position",
    "updatedAt",
    (SELECT i."id" FROM "Image" i WHERE i."boardMemberId" = "BoardMember"."id")
FROM "BoardMember";
DROP TABLE "BoardMember";
ALTER TABLE "new_BoardMember" RENAME TO "BoardMember";
CREATE UNIQUE INDEX "BoardMember_imageId_key" ON "BoardMember"("imageId");
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
    "imageId" TEXT,
    "addressId" TEXT NOT NULL,
    "createdById" TEXT,
    "formId" TEXT NOT NULL,
    CONSTRAINT "Event_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Event_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("addressId", "createdById", "date", "description", "discounts", "donationDescription", "formId", "id", "menuDescription", "price", "slots", "title", "imageId")
SELECT
    "addressId",
    "createdById",
    "date",
    "description",
    "discounts",
    "donationDescription",
    "formId",
    "id",
    "menuDescription",
    "price",
    "slots",
    "title",
    (SELECT i."id" FROM "Image" i WHERE i."eventId" = "Event"."id")
FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_imageId_key" ON "Event"("imageId");
CREATE UNIQUE INDEX "Event_formId_key" ON "Event"("formId");
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
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Image" ("altText", "blurDataUrl", "contentType", "createdAt", "height", "id", "storageKey", "updatedAt", "version", "width") SELECT "altText", "blurDataUrl", "contentType", "createdAt", "height", "id", "storageKey", "updatedAt", "version", "width" FROM "Image";
DROP TABLE "Image";
ALTER TABLE "new_Image" RENAME TO "Image";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EventGalleryImage_eventId_idx" ON "EventGalleryImage"("eventId");

-- CreateIndex
CREATE INDEX "EventGalleryImage_imageId_idx" ON "EventGalleryImage"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "EventGalleryImage_eventId_imageId_key" ON "EventGalleryImage"("eventId", "imageId");
