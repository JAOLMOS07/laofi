-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('SENT', 'TESTING', 'APPROVED', 'RETURNED');

-- CreateEnum
CREATE TYPE "DeliverySource" AS ENUM ('MANUAL', 'DEMO', 'DEVOPS');

-- CreateEnum
CREATE TYPE "MeetingSource" AS ENUM ('MANUAL', 'DEMO', 'GRAPH');

-- CreateTable
CREATE TABLE "Delivery" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fromCellId" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'SENT',
    "source" "DeliverySource" NOT NULL DEFAULT 'MANUAL',
    "note" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Delivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "roomId" TEXT NOT NULL,
    "teamsLink" TEXT,
    "source" "MeetingSource" NOT NULL DEFAULT 'MANUAL',
    "notifiedAt" TIMESTAMP(3),
    "endNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Delivery_status_updatedAt_idx" ON "Delivery"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "Meeting_userId_startsAt_idx" ON "Meeting"("userId", "startsAt");

-- CreateIndex
CREATE INDEX "Meeting_notifiedAt_startsAt_idx" ON "Meeting"("notifiedAt", "startsAt");

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_fromCellId_fkey" FOREIGN KEY ("fromCellId") REFERENCES "Cell"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Delivery" ADD CONSTRAINT "Delivery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

