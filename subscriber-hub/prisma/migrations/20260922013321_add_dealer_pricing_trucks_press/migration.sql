-- CreateEnum
CREATE TYPE "DealerType" AS ENUM ('DEALER', 'RACK', 'VENDING');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('CARRIER', 'MAIL');

-- AlterTable
ALTER TABLE "Dealer" ADD COLUMN     "dealerType" "DealerType" NOT NULL DEFAULT 'DEALER';

-- AlterTable
ALTER TABLE "RackDelivery" ADD COLUMN     "priceCentsApplied" INTEGER;

-- AlterTable
ALTER TABLE "RackRoute" ADD COLUMN     "truckId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'CARRIER';

-- CreateTable
CREATE TABLE "DealerPricing" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT,
    "paperId" TEXT NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealerPricing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerPayment" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "referenceNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealerPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Truck" (
    "id" TEXT NOT NULL,
    "truckNumber" TEXT NOT NULL,
    "driverName" TEXT,
    "phone" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Truck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PressRun" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "runDate" TIMESTAMP(3) NOT NULL,
    "bundleSize" INTEGER NOT NULL,

    CONSTRAINT "PressRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealerPricing_dealerId_paperId_dayOfWeek_idx" ON "DealerPricing"("dealerId", "paperId", "dayOfWeek");

-- CreateIndex
CREATE INDEX "DealerPayment_dealerId_paymentDate_idx" ON "DealerPayment"("dealerId", "paymentDate");

-- CreateIndex
CREATE UNIQUE INDEX "Truck_truckNumber_key" ON "Truck"("truckNumber");

-- CreateIndex
CREATE UNIQUE INDEX "PressRun_paperId_runDate_key" ON "PressRun"("paperId", "runDate");

-- AddForeignKey
ALTER TABLE "RackRoute" ADD CONSTRAINT "RackRoute_truckId_fkey" FOREIGN KEY ("truckId") REFERENCES "Truck"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerPricing" ADD CONSTRAINT "DealerPricing_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerPricing" ADD CONSTRAINT "DealerPricing_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerPayment" ADD CONSTRAINT "DealerPayment_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PressRun" ADD CONSTRAINT "PressRun_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
