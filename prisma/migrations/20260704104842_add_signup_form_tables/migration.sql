-- Adds Form / FormVersion / FormSubmission and the non-nullable unique
-- Event.formId. Hand-edited after `migrate dev --create-only`: existing events
-- are backfilled with one Form + FormVersion v1 (DEFAULT_FORM) each before the
-- Event table gains the required column, so the invariant "every event has a
-- form" holds by construction.

-- CreateTable
CREATE TABLE "Form" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FormVersion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "version" INTEGER NOT NULL,
    "schema" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "formId" TEXT NOT NULL,
    CONSTRAINT "FormVersion_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FormSubmission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "answers" JSONB NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "formVersionId" TEXT NOT NULL,
    CONSTRAINT "FormSubmission_formVersionId_fkey" FOREIGN KEY ("formVersionId") REFERENCES "FormVersion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Backfill: one Form + FormVersion v1 per existing event. The version's schema
-- is DEFAULT_FORM (app/features/signup-form/default-form.ts), which reproduces
-- the live signup form. Row ids are derived from the (unique) event id — the
-- id column only requires uniqueness, not cuid shape.
INSERT INTO "Form" ("id", "createdAt", "updatedAt")
SELECT 'form_' || "id", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Event";

INSERT INTO "FormVersion" ("id", "version", "schema", "createdAt", "updatedAt", "formId")
SELECT
    'formversion_' || "id",
    1,
    '[{"type":"text","version":1,"data":{"name":"name","label":"Name","required":true}},{"type":"email","version":1,"data":{"name":"email","label":"Email","required":true}},{"type":"phone","version":1,"data":{"name":"phone","label":"Phone number","required":true}},{"type":"checkbox","version":1,"data":{"name":"vegetarian","label":"Vegan / Vegetarian","required":false}},{"type":"checkbox","version":1,"data":{"name":"student","label":"Student","required":false}},{"type":"text","version":1,"data":{"name":"restrictions","label":"Dietary restrictions","required":false}},{"type":"list","version":1,"data":{"name":"friends","label":"Friends","required":false,"maxCount":3,"addLabel":"Add a friend","removeLabel":"Remove this person","itemFields":[{"type":"text","version":1,"data":{"name":"name","label":"Name","required":true}},{"type":"checkbox","version":1,"data":{"name":"vegetarian","label":"Vegan / Vegetarian","required":false}},{"type":"checkbox","version":1,"data":{"name":"student","label":"Student","required":false}},{"type":"text","version":1,"data":{"name":"restrictions","label":"Dietary restrictions","required":false}}]}},{"type":"textarea","version":1,"data":{"name":"comment","label":"Comment","required":false}}]',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    'form_' || "id"
FROM "Event";

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "imageId" TEXT NOT NULL,
    "addressId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    CONSTRAINT "Event_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_addressId_fkey" FOREIGN KEY ("addressId") REFERENCES "Address" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Event_formId_fkey" FOREIGN KEY ("formId") REFERENCES "Form" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Event" ("addressId", "createdById", "date", "description", "discounts", "donationDescription", "id", "imageId", "menuDescription", "price", "slots", "title", "formId") SELECT "addressId", "createdById", "date", "description", "discounts", "donationDescription", "id", "imageId", "menuDescription", "price", "slots", "title", 'form_' || "id" FROM "Event";
DROP TABLE "Event";
ALTER TABLE "new_Event" RENAME TO "Event";
CREATE UNIQUE INDEX "Event_imageId_key" ON "Event"("imageId");
CREATE UNIQUE INDEX "Event_formId_key" ON "Event"("formId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "FormVersion_formId_version_key" ON "FormVersion"("formId", "version");
