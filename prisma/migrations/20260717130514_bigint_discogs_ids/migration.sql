/*
  Warnings:

  - You are about to alter the column `instanceId` on the `Record` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.
  - You are about to alter the column `releaseId` on the `Record` table. The data in that column could be lost. The data in that column will be cast from `Int` to `BigInt`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Record" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instanceId" BIGINT NOT NULL,
    "releaseId" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL,
    "artistSort" TEXT NOT NULL,
    "searchText" TEXT NOT NULL DEFAULT '',
    "year" INTEGER,
    "format" TEXT NOT NULL,
    "formatDetail" TEXT,
    "label" TEXT,
    "catalogNumber" TEXT,
    "country" TEXT,
    "genres" TEXT NOT NULL DEFAULT '[]',
    "styles" TEXT NOT NULL DEFAULT '[]',
    "tracklist" TEXT,
    "coverUrl" TEXT,
    "coverFile" TEXT,
    "discogsUrl" TEXT,
    "addedAt" DATETIME NOT NULL,
    "syncedAt" DATETIME NOT NULL,
    "archivedAt" DATETIME,
    "isFavorite" BOOLEAN NOT NULL DEFAULT false,
    "customOrder" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Record" ("addedAt", "archivedAt", "artist", "artistSort", "catalogNumber", "country", "coverFile", "coverUrl", "createdAt", "customOrder", "discogsUrl", "format", "formatDetail", "genres", "id", "instanceId", "isFavorite", "label", "releaseId", "searchText", "styles", "syncedAt", "title", "tracklist", "updatedAt", "year") SELECT "addedAt", "archivedAt", "artist", "artistSort", "catalogNumber", "country", "coverFile", "coverUrl", "createdAt", "customOrder", "discogsUrl", "format", "formatDetail", "genres", "id", "instanceId", "isFavorite", "label", "releaseId", "searchText", "styles", "syncedAt", "title", "tracklist", "updatedAt", "year" FROM "Record";
DROP TABLE "Record";
ALTER TABLE "new_Record" RENAME TO "Record";
CREATE UNIQUE INDEX "Record_instanceId_key" ON "Record"("instanceId");
CREATE INDEX "Record_archivedAt_idx" ON "Record"("archivedAt");
CREATE INDEX "Record_addedAt_idx" ON "Record"("addedAt");
CREATE INDEX "Record_customOrder_idx" ON "Record"("customOrder");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
