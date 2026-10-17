-- AlterEnum
ALTER TYPE "StockMovementType" ADD VALUE 'TRANSFER';

-- AlterTable
ALTER TABLE "Stock" ADD COLUMN     "reorderPoint" INTEGER NOT NULL DEFAULT 4;

-- AlterTable
ALTER TABLE "StockMovement" ADD COLUMN     "reference" TEXT;

-- CreateIndex
CREATE INDEX "StockMovement_branchId_createdAt_idx" ON "StockMovement"("branchId", "createdAt");


-- Hand-written invariant
ALTER TABLE "Stock" ADD CONSTRAINT "Stock_reorderPoint_check" CHECK ("reorderPoint" >= 0);
