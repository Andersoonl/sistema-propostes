-- AlterTable
ALTER TABLE "CostRecipe" ADD COLUMN "piecesPerPallet" INTEGER;

-- AlterTable
ALTER TABLE "ProductionItem" ADD COLUMN "areaM2" REAL;
ALTER TABLE "ProductionItem" ADD COLUMN "pallets" REAL;

-- CreateTable
CREATE TABLE "MaterialEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ingredientId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "quantity" REAL NOT NULL,
    "unitPrice" REAL NOT NULL,
    "supplier" TEXT,
    "invoiceNumber" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MaterialEntry_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryMovement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "type" TEXT NOT NULL,
    "quantityPieces" INTEGER NOT NULL,
    "quantityPallets" REAL,
    "areaM2" REAL,
    "notes" TEXT,
    "productionDayId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
