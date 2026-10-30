-- CreateTable
CREATE TABLE "Rate" (
    "id" TEXT NOT NULL,
    "paperId" TEXT NOT NULL,
    "newzwareId" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "onlineDescription" TEXT,
    "deliveryMethod" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "issueDays" TEXT NOT NULL,
    "lengthCount" INTEGER NOT NULL,
    "lengthUnit" TEXT NOT NULL,
    "zone" TEXT,
    "payMethod" TEXT NOT NULL,
    "easyPay" BOOLEAN NOT NULL DEFAULT false,
    "isGift" BOOLEAN NOT NULL DEFAULT false,
    "isOldRate" BOOLEAN NOT NULL DEFAULT false,
    "priceCents" INTEGER NOT NULL,
    "fullRateCents" INTEGER NOT NULL,
    "step" INTEGER NOT NULL DEFAULT 0,
    "nextStep" INTEGER NOT NULL DEFAULT 0,
    "chainKey" TEXT NOT NULL,
    "effectiveDate" TIMESTAMP(3),
    "inactiveDate" TIMESTAMP(3),
    "showOnline" BOOLEAN NOT NULL DEFAULT false,
    "glAccount" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rate_newzwareId_key" ON "Rate"("newzwareId");

-- CreateIndex
CREATE INDEX "Rate_paperId_active_idx" ON "Rate"("paperId", "active");

-- CreateIndex
CREATE INDEX "Rate_chainKey_step_idx" ON "Rate"("chainKey", "step");

-- AddForeignKey
ALTER TABLE "Rate" ADD CONSTRAINT "Rate_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "Paper"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
