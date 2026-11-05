-- AlterEnum
ALTER TYPE "DeliveryStatus" ADD VALUE 'DEPLOYED';

-- AlterTable
ALTER TABLE "Delivery" ADD COLUMN     "url" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "currentWork" JSONB;

