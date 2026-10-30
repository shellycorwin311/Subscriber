/*
  Warnings:

  - A unique constraint covering the columns `[dealerId,paperId,dayOfWeek]` on the table `DealerStandingOrder` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `dayOfWeek` to the `DealerStandingOrder` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- DropIndex
DROP INDEX "DealerStandingOrder_dealerId_paperId_key";

-- AlterTable
ALTER TABLE "DealerStandingOrder" ADD COLUMN     "dayOfWeek" "DayOfWeek" NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "DealerStandingOrder_dealerId_paperId_dayOfWeek_key" ON "DealerStandingOrder"("dealerId", "paperId", "dayOfWeek");
