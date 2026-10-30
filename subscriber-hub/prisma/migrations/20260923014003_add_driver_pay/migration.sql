-- CreateEnum
CREATE TYPE "DriverType" AS ENUM ('EMPLOYEE', 'CONTRACTOR');

-- CreateEnum
CREATE TYPE "PayPeriodStatus" AS ENUM ('OPEN', 'INVOICED', 'PAID');

-- AlterTable
ALTER TABLE "Truck" ADD COLUMN     "addressLine1" TEXT,
ADD COLUMN     "city" TEXT,
ADD COLUMN     "driverType" "DriverType" NOT NULL DEFAULT 'EMPLOYEE',
ADD COLUMN     "payPerDropCents" INTEGER,
ADD COLUMN     "state" TEXT,
ADD COLUMN     "zip" TEXT;

-- CreateTable
CREATE TABLE "DriverPayPeriod" (
    "id" TEXT NOT NULL,
    "truckId" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "dropCount" INTEGER NOT NULL DEFAULT 0,
    "dropPayCents" INTEGER NOT NULL DEFAULT 0,
    "fuelMileageCents" INTEGER NOT NULL DEFAULT 0,
    "postOfficeDropsCents" INTEGER NOT NULL DEFAULT 0,
    "advertisingDeliveryCents" INTEGER NOT NULL DEFAULT 0,
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "status" "PayPeriodStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverPayPeriod_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DriverPayPeriod_truckId_periodStart_periodEnd_key" ON "DriverPayPeriod"("truckId", "periodStart", "periodEnd");

-- AddForeignKey
ALTER TABLE "DriverPayPeriod" ADD CONSTRAINT "DriverPayPeriod_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
