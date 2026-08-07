-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "salonCovered" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: salons currently visible (subscriptionActive=true) were covered under
-- the old first-N model — grandfather that coverage so nothing regresses.
UPDATE "tenants" SET "salonCovered" = true WHERE "subscriptionActive" = true AND "isActive" = true;
