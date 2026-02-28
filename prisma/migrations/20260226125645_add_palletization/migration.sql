-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN "palletizationId" TEXT;

-- CreateTable
CREATE TABLE "Palletization" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "productionDate" DATETIME NOT NULL,
    "palletizedDate" DATETIME NOT NULL,
    "theoreticalPieces" INTEGER NOT NULL,
    "completePallets" INTEGER NOT NULL,
    "loosePiecesAfter" INTEGER NOT NULL,
    "piecesPerPallet" INTEGER NOT NULL,
    "realPieces" INTEGER NOT NULL,
    "lossPieces" INTEGER NOT NULL,
    "loosePiecesBefore" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Palletization_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoosePiecesBalance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "pieces" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LoosePiecesBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Palletization_productId_productionDate_key" ON "Palletization"("productId", "productionDate");

-- CreateIndex
CREATE UNIQUE INDEX "LoosePiecesBalance_productId_key" ON "LoosePiecesBalance"("productId");
