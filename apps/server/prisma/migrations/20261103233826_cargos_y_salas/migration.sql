-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "description" TEXT,
ADD COLUMN     "linkEditableByAll" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "title" TEXT;
