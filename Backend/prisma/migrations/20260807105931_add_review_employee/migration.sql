-- AlterTable
ALTER TABLE "billing_configs" ALTER COLUMN "freeEmployeeThreshold" SET DEFAULT 0;

-- AlterTable
ALTER TABLE "reviews" ADD COLUMN     "employeeId" TEXT;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
