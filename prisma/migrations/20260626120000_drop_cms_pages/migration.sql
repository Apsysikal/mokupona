-- Revert the CMS pages schema introduced by 20260412151606_add_cms_pages.
-- This drops the tables; the migration history retains both records so that
-- `prisma migrate deploy` converges any environment back to the pre-CMS schema.

-- DropTable
DROP TABLE "PageBlock";

-- DropTable
DROP TABLE "Page";
