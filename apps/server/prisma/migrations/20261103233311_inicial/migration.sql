-- CreateEnum
CREATE TYPE "CellType" AS ENUM ('DEV', 'QA', 'INFRA');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "Status" AS ENUM ('AVAILABLE', 'BUSY', 'FOCUS', 'MEETING', 'AWAY');

-- CreateEnum
CREATE TYPE "RoomKind" AS ENUM ('CELL', 'SHARED', 'AUDITORIUM', 'CAFETERIA');

-- CreateEnum
CREATE TYPE "KnockResponse" AS ENUM ('ENTER', 'WAIT_10', 'NOT_NOW');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MEMBER',
    "cellId" TEXT,
    "avatarConfig" JSONB NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Cell" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CellType" NOT NULL,
    "color" TEXT NOT NULL,
    "logoUrl" TEXT,
    "floorId" TEXT,

    CONSTRAINT "Cell_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Floor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "isCommon" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "layout" JSONB NOT NULL,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Office" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT,
    "floorId" TEXT NOT NULL,
    "gridX" INTEGER NOT NULL,
    "gridY" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "depth" INTEGER NOT NULL,
    "doorSide" TEXT NOT NULL DEFAULT 's',
    "doorAt" INTEGER NOT NULL,
    "wallColor" TEXT,
    "floorColor" TEXT,

    CONSTRAINT "Office_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Room" (
    "id" TEXT NOT NULL,
    "floorId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "RoomKind" NOT NULL,
    "teamsLink" TEXT,
    "gridX" INTEGER NOT NULL,
    "gridY" INTEGER NOT NULL,
    "width" INTEGER NOT NULL,
    "depth" INTEGER NOT NULL,
    "doorSide" TEXT NOT NULL DEFAULT 's',
    "doorAt" INTEGER NOT NULL,

    CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FurnitureCatalog" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelUrl" TEXT,
    "footprintW" INTEGER NOT NULL,
    "footprintD" INTEGER NOT NULL,
    "colorable" BOOLEAN NOT NULL,

    CONSTRAINT "FurnitureCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlacedFurniture" (
    "id" TEXT NOT NULL,
    "officeId" TEXT,
    "floorId" TEXT,
    "catalogId" TEXT NOT NULL,
    "gridX" INTEGER NOT NULL,
    "gridY" INTEGER NOT NULL,
    "rotation" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT,

    CONSTRAINT "PlacedFurniture_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Note" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Note_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Knock" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "response" "KnockResponse",
    "queued" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Knock_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Cell_floorId_key" ON "Cell"("floorId");

-- CreateIndex
CREATE UNIQUE INDEX "Floor_level_key" ON "Floor"("level");

-- CreateIndex
CREATE UNIQUE INDEX "Office_ownerId_key" ON "Office"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "FurnitureCatalog_key_key" ON "FurnitureCatalog"("key");

-- CreateIndex
CREATE INDEX "Note_toUserId_readAt_idx" ON "Note"("toUserId", "readAt");

-- CreateIndex
CREATE INDEX "Knock_toUserId_response_idx" ON "Knock"("toUserId", "response");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_cellId_fkey" FOREIGN KEY ("cellId") REFERENCES "Cell"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Cell" ADD CONSTRAINT "Cell_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Office" ADD CONSTRAINT "Office_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Room" ADD CONSTRAINT "Room_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacedFurniture" ADD CONSTRAINT "PlacedFurniture_officeId_fkey" FOREIGN KEY ("officeId") REFERENCES "Office"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacedFurniture" ADD CONSTRAINT "PlacedFurniture_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlacedFurniture" ADD CONSTRAINT "PlacedFurniture_catalogId_fkey" FOREIGN KEY ("catalogId") REFERENCES "FurnitureCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Note" ADD CONSTRAINT "Note_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knock" ADD CONSTRAINT "Knock_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Knock" ADD CONSTRAINT "Knock_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
