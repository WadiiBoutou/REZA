-- CreateEnum
CREATE TYPE "InvoiceType" AS ENUM ('SALE', 'SUBSCRIPTION');

-- DropForeignKey
ALTER TABLE "invoices" DROP CONSTRAINT "invoices_clientId_fkey";

-- DropIndex
DROP INDEX "appointment_service_items_employeeId_idx";

-- AlterTable
ALTER TABLE "accounts" ADD COLUMN     "billingPaymentMethod" JSONB;

-- AlterTable
ALTER TABLE "appointment_service_items" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "accountId" TEXT,
ADD COLUMN     "periodEnd" TIMESTAMP(3),
ADD COLUMN     "periodStart" TIMESTAMP(3),
ADD COLUMN     "type" "InvoiceType" NOT NULL DEFAULT 'SALE';

-- CreateIndex
CREATE INDEX "invoices_accountId_idx" ON "invoices"("accountId");

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;
