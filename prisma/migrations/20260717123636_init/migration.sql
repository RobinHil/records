-- CreateTable
CREATE TABLE "User" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Record" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instanceId" INTEGER NOT NULL,
    "releaseId" INTEGER NOT NULL,
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

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'running',
    "added" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "archived" INTEGER NOT NULL DEFAULT 0,
    "restored" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT
);

-- CreateIndex
CREATE UNIQUE INDEX "Record_instanceId_key" ON "Record"("instanceId");

-- CreateIndex
CREATE INDEX "Record_archivedAt_idx" ON "Record"("archivedAt");

-- CreateIndex
CREATE INDEX "Record_addedAt_idx" ON "Record"("addedAt");

-- CreateIndex
CREATE INDEX "Record_customOrder_idx" ON "Record"("customOrder");
