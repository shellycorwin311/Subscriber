/*
  Warnings:

  - The values [RACK] on the enum `DealerType` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "DealerType_new" AS ENUM ('DEALER', 'VENDING', 'SERVICE');
ALTER TABLE "Dealer" ALTER COLUMN "dealerType" DROP DEFAULT;
ALTER TABLE "Dealer" ALTER COLUMN "dealerType" TYPE "DealerType_new" USING ("dealerType"::text::"DealerType_new");
ALTER TYPE "DealerType" RENAME TO "DealerType_old";
ALTER TYPE "DealerType_new" RENAME TO "DealerType";
DROP TYPE "DealerType_old";
ALTER TABLE "Dealer" ALTER COLUMN "dealerType" SET DEFAULT 'DEALER';
COMMIT;
