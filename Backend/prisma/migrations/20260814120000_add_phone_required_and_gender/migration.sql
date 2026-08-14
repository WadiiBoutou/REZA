-- Backfill NULL phones so the NOT NULL constraint can be applied safely.
UPDATE "users" SET "phone" = '' WHERE "phone" IS NULL;
UPDATE "employees" SET "phone" = '' WHERE "phone" IS NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "phone" SET NOT NULL;
ALTER TABLE "employees" ALTER COLUMN "phone" SET NOT NULL;

-- Gender (optional) for clients and employees
ALTER TABLE "clients" ADD COLUMN "gender" TEXT;
ALTER TABLE "employees" ADD COLUMN "gender" TEXT;
