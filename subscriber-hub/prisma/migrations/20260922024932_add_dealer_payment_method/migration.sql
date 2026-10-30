-- CreateEnum
CREATE TYPE "DealerPaymentMethod" AS ENUM ('CHECK', 'CARD', 'ACH');

-- AlterTable
ALTER TABLE "DealerPayment" ADD COLUMN     "paymentMethod" "DealerPaymentMethod" NOT NULL DEFAULT 'CHECK';
