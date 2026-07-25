-- Auth rework cutover (docs/auth-rework/design.md §7):
--  * better-auth tables (Session/Account/Verification), new User fields
--  * Password table dropped — old bcrypt hashes intentionally die here
--  * name backfilled from the email local-part
--  * every existing user gets a credential Account row holding a scrypt hash
--    of a random secret that was generated once and discarded, so no password
--    can ever match it. It exists so the reset flow always has a credential
--    account to update; "forgot password" is the migration path for everyone.

-- DropIndex
DROP INDEX "Password_userId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Password";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" DATETIME,
    "refreshTokenExpiresAt" DATETIME,
    "scope" TEXT,
    "password" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "userId" TEXT NOT NULL,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Verification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables (User gains name/emailVerified/image; name backfilled from
-- the email local-part)
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "roleId" TEXT NOT NULL,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
-- email lowercased: better-auth lowercases every lookup and SQLite equality
-- is case-sensitive, so a mixed-case row would be unreachable (no login, no
-- reset). If two existing rows collide case-insensitively, the unique index
-- below fails the migration loudly — resolve those by hand first.
INSERT INTO "new_User" ("createdAt", "email", "name", "id", "roleId", "updatedAt")
SELECT
    "createdAt",
    lower("email"),
    CASE
        WHEN instr("email", '@') > 1 THEN substr("email", 1, instr("email", '@') - 1)
        ELSE "email"
    END,
    "id",
    "roleId",
    "updatedAt"
FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE INDEX "Verification_identifier_idx" ON "Verification"("identifier");

-- Data migration: credential Account per existing user (accountId = user id,
-- better-auth's convention for the credential provider). The scrypt hash below
-- is of a 32-byte random secret generated with better-auth's hashPassword and
-- thrown away — format-valid, matches nothing, replaced on first reset.
INSERT INTO "Account" ("id", "accountId", "providerId", "password", "createdAt", "updatedAt", "userId")
SELECT
    lower(hex(randomblob(16))),
    "id",
    'credential',
    '4a4405fbb8bccc53c2f06ae60b3802a2:3f673aec073c7fb2f66fd9482c755318451e361b06e6e14f9565145c4fa0a32ab3bcad4cf86407b7e78946e07624c898b7a53363150653047333a6bcf56f40f3',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP,
    "id"
FROM "User";
