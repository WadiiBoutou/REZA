-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "categories" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
