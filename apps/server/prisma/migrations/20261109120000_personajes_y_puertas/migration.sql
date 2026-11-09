-- Estado "Almorzando", ausencias largas, puerta manual de la oficina y ajustes generales (horario de oficina).
ALTER TYPE "Status" ADD VALUE 'LUNCH';

ALTER TABLE "Office" ADD COLUMN "doorClosed" BOOLEAN;

ALTER TABLE "User" ADD COLUMN "absence" JSONB;

CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);
