/*
  Warnings:

  - You are about to drop the column `stripePriceId` on the `subscription_plans` table. All the data in the column will be lost.
  - You are about to drop the column `stripeCustomerId` on the `subscriptions` table. All the data in the column will be lost.
  - You are about to drop the column `stripeSubscriptionId` on the `subscriptions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "subscription_plans" DROP COLUMN "stripePriceId";

-- AlterTable
ALTER TABLE "subscriptions" DROP COLUMN "stripeCustomerId",
DROP COLUMN "stripeSubscriptionId",
ADD COLUMN     "employeesPaid" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "salonsPaid" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "subscribedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "employeesPaid" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "billing_configs" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "pricePerSalon" DOUBLE PRECISION NOT NULL DEFAULT 1000,
    "freeEmployeeThreshold" INTEGER NOT NULL DEFAULT 2,
    "pricePerEmployee" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "currency" TEXT NOT NULL DEFAULT 'MAD',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "billing_configs_pkey" PRIMARY KEY ("id")
);
