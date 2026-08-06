-- CreateEnum
CREATE TYPE "AppointmentSource" AS ENUM ('STAFF', 'ONLINE');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "source" "AppointmentSource" NOT NULL DEFAULT 'STAFF';
