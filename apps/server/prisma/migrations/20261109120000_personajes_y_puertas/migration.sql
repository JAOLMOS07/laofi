-- Estado "Almorzando", puerta manual de la oficina y ajustes generales (horario de oficina).
ALTER TYPE "Status" ADD VALUE 'LUNCH';

ALTER TABLE "Office" ADD COLUMN "doorClosed" BOOLEAN;

CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);
