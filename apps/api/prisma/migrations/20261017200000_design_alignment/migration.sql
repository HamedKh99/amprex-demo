-- Aligns the model with the approved design handoff:
-- 5-step technician flow with combined finish & settlement, Ah-based old-battery credit,
-- AMX tracking codes, install location, branch note, technician zones/capacity, cost price.
-- Existing rows are backfilled so a database seeded with the previous version upgrades in place.

-- New enums
CREATE TYPE "OrderEventKind" AS ENUM ('STATUS', 'NOTE');
CREATE TYPE "VehicleType" AS ENUM ('CAR', 'MOTORCYCLE');
CREATE TYPE "InstallLocation" AS ENUM ('PARKING', 'STREET', 'WORKPLACE');

-- OrderStatus: INSTALLED/PAID no longer exist; installation and payment are one step that ends
-- in COMPLETED, so legacy INSTALLED/PAID rows become COMPLETED.
CREATE TYPE "OrderStatus_new" AS ENUM ('CREATED', 'ASSIGNED', 'ACCEPTED', 'EN_ROUTE', 'ON_SITE', 'INSTALLING', 'COMPLETED', 'CANCELLED');
ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE "OrderStatus_new"
  USING (CASE "status"::text WHEN 'INSTALLED' THEN 'COMPLETED' WHEN 'PAID' THEN 'COMPLETED' ELSE "status"::text END)::"OrderStatus_new";
ALTER TABLE "OrderEvent" ALTER COLUMN "fromStatus" TYPE "OrderStatus_new"
  USING (CASE "fromStatus"::text WHEN 'INSTALLED' THEN 'INSTALLING' WHEN 'PAID' THEN 'INSTALLING' ELSE "fromStatus"::text END)::"OrderStatus_new";
ALTER TABLE "OrderEvent" ALTER COLUMN "toStatus" TYPE "OrderStatus_new"
  USING (CASE "toStatus"::text WHEN 'INSTALLED' THEN 'INSTALLING' WHEN 'PAID' THEN 'COMPLETED' ELSE "toStatus"::text END)::"OrderStatus_new";
ALTER TYPE "OrderStatus" RENAME TO "OrderStatus_old";
ALTER TYPE "OrderStatus_new" RENAME TO "OrderStatus";
DROP TYPE "OrderStatus_old";
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'CREATED';
UPDATE "Order" o SET "completedAt" = COALESCE(o."completedAt", m."installedAt", o."updatedAt")
  FROM "Mission" m WHERE m."orderId" = o.id AND o.status = 'COMPLETED' AND o."completedAt" IS NULL;

-- Technician zones and capacity (backfilled from the branch)
ALTER TABLE "Technician" ADD COLUMN "dailyCapacity" INTEGER NOT NULL DEFAULT 6,
  ADD COLUMN "serviceDistricts" INTEGER[] NOT NULL DEFAULT '{}';
UPDATE "Technician" t SET "serviceDistricts" = b."serviceDistricts" FROM "Branch" b WHERE b.id = t."branchId";
ALTER TABLE "Technician" ALTER COLUMN "serviceDistricts" DROP DEFAULT;

-- Vehicle models
ALTER TABLE "VehicleModel" ADD COLUMN "type" "VehicleType" NOT NULL DEFAULT 'CAR',
  ADD COLUMN "brandFa" TEXT, ADD COLUMN "factoryAh" INTEGER, ADD COLUMN "groupSize" TEXT;
UPDATE "VehicleModel" SET "brandFa" = "make", "factoryAh" = 60, "groupSize" = '';
ALTER TABLE "VehicleModel" ALTER COLUMN "brandFa" SET NOT NULL, ALTER COLUMN "factoryAh" SET NOT NULL,
  ALTER COLUMN "groupSize" SET NOT NULL;

-- Batteries: per-battery core credit is replaced by the per-Ah rule; cost price added
ALTER TABLE "Battery" DROP CONSTRAINT IF EXISTS "Battery_money_check";
ALTER TABLE "Battery" DROP COLUMN "coreCreditRial", ADD COLUMN "costRial" BIGINT, ADD COLUMN "series" TEXT;
UPDATE "Battery" SET "costRial" = "priceRial" * 73 / 100, "series" = '';
ALTER TABLE "Battery" ALTER COLUMN "costRial" SET NOT NULL, ALTER COLUMN "series" SET NOT NULL;
ALTER TABLE "Battery" ADD CONSTRAINT "Battery_money_check" CHECK ("priceRial" > 0 AND "costRial" >= 0);

ALTER TABLE "BatteryCompatibility" RENAME COLUMN "isRecommended" TO "matchesFactorySpec";

-- Orders
ALTER TABLE "Order" ADD COLUMN "code" TEXT, ADD COLUMN "batteryCostRial" BIGINT,
  ADD COLUMN "branchNote" TEXT, ADD COLUMN "estimatedCoreAh" INTEGER,
  ADD COLUMN "installLocation" "InstallLocation" NOT NULL DEFAULT 'PARKING';
UPDATE "Order" o SET "code" = 'AMX-LEGACY-' || o."number",
  "batteryCostRial" = b."costRial",
  "estimatedCoreAh" = CASE WHEN o."coreReturnExpected" THEN b."capacityAh" END
  FROM "Battery" b WHERE b.id = o."batteryId";
ALTER TABLE "Order" ALTER COLUMN "code" SET NOT NULL, ALTER COLUMN "batteryCostRial" SET NOT NULL;
ALTER TABLE "Order" DROP COLUMN "coreReturnExpected";
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");

-- Order events: NOTE rows have no status
ALTER TABLE "OrderEvent" ADD COLUMN "kind" "OrderEventKind" NOT NULL DEFAULT 'STATUS',
  ALTER COLUMN "toStatus" DROP NOT NULL;
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_kind_check"
  CHECK (("kind" = 'STATUS' AND "toStatus" IS NOT NULL) OR "kind" = 'NOTE');

-- Missions
ALTER TABLE "Mission" ADD COLUMN "acceptedAt" TIMESTAMPTZ(3), ADD COLUMN "startedAt" TIMESTAMPTZ(3);

-- Old battery: condition → returned + Ah
ALTER TABLE "CoreReturn" ADD COLUMN "returned" BOOLEAN, ADD COLUMN "ampereHours" INTEGER,
  ADD COLUMN "scrapValueRial" BIGINT NOT NULL DEFAULT 0;
UPDATE "CoreReturn" SET "returned" = ("condition" <> 'NOT_RETURNED');
ALTER TABLE "CoreReturn" ALTER COLUMN "returned" SET NOT NULL, ALTER COLUMN "scrapValueRial" DROP DEFAULT;
ALTER TABLE "CoreReturn" DROP COLUMN "condition", DROP COLUMN "oldBatteryNote";
DROP TYPE "CoreCondition";
ALTER TABLE "CoreReturn" ADD CONSTRAINT "CoreReturn_ah_check"
  CHECK ("ampereHours" IS NULL OR ("returned" AND "ampereHours" > 0));

-- Payments: expected vs received
ALTER TABLE "Payment" ADD COLUMN "expectedRial" BIGINT;
UPDATE "Payment" SET "expectedRial" = "amountRial";
ALTER TABLE "Payment" ALTER COLUMN "expectedRial" SET NOT NULL;
ALTER TABLE "Payment" DROP CONSTRAINT IF EXISTS "Payment_amount_check";
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_check" CHECK ("amountRial" >= 0 AND "expectedRial" >= 0);
