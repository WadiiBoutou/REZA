-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "participantName" TEXT;

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "bookingGroupId" TEXT;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_bookingGroupId_fkey" FOREIGN KEY ("bookingGroupId") REFERENCES "booking_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
