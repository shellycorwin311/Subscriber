/*
  Warnings:

  - A unique constraint covering the columns `[dealerNumber]` on the table `Dealer` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Dealer" ADD COLUMN     "dealerNumber" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Dealer_dealerNumber_key" ON "Dealer"("dealerNumber");
