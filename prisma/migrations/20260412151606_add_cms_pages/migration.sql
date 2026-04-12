-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageKey" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PageBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "pageId" TEXT NOT NULL,
    "definitionKey" TEXT,
    "type" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    CONSTRAINT "PageBlock_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "Page" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Page_pageKey_key" ON "Page"("pageKey");

-- CreateIndex
CREATE INDEX "PageBlock_pageId_position_idx" ON "PageBlock"("pageId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "PageBlock_pageId_position_key" ON "PageBlock"("pageId", "position");
