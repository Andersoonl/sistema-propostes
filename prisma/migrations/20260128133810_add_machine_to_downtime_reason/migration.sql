-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_DowntimeReason" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parentId" TEXT,
    "machineId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DowntimeReason_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DowntimeReason" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DowntimeReason_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_DowntimeReason" ("createdAt", "id", "level", "name", "parentId") SELECT "createdAt", "id", "level", "name", "parentId" FROM "DowntimeReason";
DROP TABLE "DowntimeReason";
ALTER TABLE "new_DowntimeReason" RENAME TO "DowntimeReason";
CREATE UNIQUE INDEX "DowntimeReason_name_level_parentId_machineId_key" ON "DowntimeReason"("name", "level", "parentId", "machineId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
