-- CreateTable
CREATE TABLE "Machine" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ShiftOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "breakMinutes" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ShiftOverride_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionDay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "machineId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "hasProductSwap" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductionDay_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productionDayId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "cycles" INTEGER NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProductionItem_productionDayId_fkey" FOREIGN KEY ("productionDayId") REFERENCES "ProductionDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductionItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DowntimeReason" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "parentId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DowntimeReason_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "DowntimeReason" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DowntimeEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productionDayId" TEXT NOT NULL,
    "reasonId" TEXT NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DowntimeEvent_productionDayId_fkey" FOREIGN KEY ("productionDayId") REFERENCES "ProductionDay" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "DowntimeEvent_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "DowntimeReason" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Machine_name_key" ON "Machine"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Product_name_key" ON "Product"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftOverride_machineId_date_key" ON "ShiftOverride"("machineId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionDay_machineId_date_key" ON "ProductionDay"("machineId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionItem_productionDayId_productId_key" ON "ProductionItem"("productionDayId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "DowntimeReason_name_level_parentId_key" ON "DowntimeReason"("name", "level", "parentId");
