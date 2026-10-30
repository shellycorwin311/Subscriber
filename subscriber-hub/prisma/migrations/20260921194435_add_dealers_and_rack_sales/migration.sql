-- CreateEnum
CREATE TYPE "DealerStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "RackDeliveryStatus" AS ENUM ('DELIVERED', 'RECONCILED');

-- AlterTable
ALTER TABLE "Paper" ADD COLUMN     "coverPriceCents" INTEGER,
ADD COLUMN     "wholesalePriceCents" INTEGER;

-- CreateTable
CREATE TABLE "Dealer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zip" TEXT,
    "status" "DealerStatus" NOT NULL DEFAULT 'ACTIVE',
    "creditTerms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dealer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DealerStandingOrder" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "DealerStandingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RackRoute" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RackRoute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RackRouteStop" (
    "id" TEXT NOT NULL,
    "rackRouteId" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "RackRouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RackDelivery" (
    "id" TEXT NOT NULL,
    "dealerId" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "deliveryDate" TIMESTAMP(3) NOT NULL,
    "quantityDelivered" INTEGER NOT NULL,
    "quantitySold" INTEGER,
    "quantityReturned" INTEGER,
    "creditCents" INTEGER,
    "status" "RackDeliveryStatus" NOT NULL DEFAULT 'DELIVERED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reconciledAt" TIMESTAMP(3),

    CONSTRAINT "RackDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Dealer_name_zip_idx" ON "Dealer"("name", "zip");

-- CreateIndex
CREATE UNIQUE INDEX "DealerStandingOrder_dealerId_paperId_key" ON "DealerStandingOrder"("dealerId", "paperId");

-- CreateIndex
CREATE INDEX "RackRoute_paperId_name_idx" ON "RackRoute"("paperId", "name");

-- CreateIndex
CREATE INDEX "RackRouteStop_rackRouteId_sequence_idx" ON "RackRouteStop"("rackRouteId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "RackRouteStop_rackRouteId_dealerId_key" ON "RackRouteStop"("rackRouteId", "dealerId");

-- CreateIndex
CREATE INDEX "RackDelivery_dealerId_paperId_deliveryDate_idx" ON "RackDelivery"("dealerId", "paperId", "deliveryDate");

-- AddForeignKey
ALTER TABLE "DealerStandingOrder" ADD CONSTRAINT "DealerStandingOrder_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealerStandingOrder" ADD CONSTRAINT "DealerStandingOrder_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RackRoute" ADD CONSTRAINT "RackRoute_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RackRouteStop" ADD CONSTRAINT "RackRouteStop_rackRouteId_fkey" FOREIGN KEY ("rackRouteId") REFERENCES "RackRoute"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RackRouteStop" ADD CONSTRAINT "RackRouteStop_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RackDelivery" ADD CONSTRAINT "RackDelivery_dealerId_fkey" FOREIGN KEY ("dealerId") REFERENCES "Dealer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RackDelivery" ADD CONSTRAINT "RackDelivery_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
