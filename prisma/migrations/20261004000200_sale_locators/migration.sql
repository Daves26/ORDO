CREATE TYPE "LocatorSource" AS ENUM ('MAYORISTA', 'PROVEEDOR', 'AEROLINEA', 'HOTEL', 'ASISTENCIA_MEDICA', 'OTRO');

CREATE TABLE "SaleLocator" (
    "id" UUID NOT NULL,
    "saleId" UUID NOT NULL,
    "serviceId" UUID,
    "source" "LocatorSource" NOT NULL,
    "issuerName" TEXT,
    "code" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "SaleLocator_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "SaleLocator_code_valid" CHECK (length(btrim("code")) BETWEEN 1 AND 120 AND "code" !~ '[[:cntrl:]]'),
    CONSTRAINT "SaleLocator_issuer_valid" CHECK ("issuerName" IS NULL OR length("issuerName") <= 120),
    CONSTRAINT "SaleLocator_notes_valid" CHECK ("notes" IS NULL OR length("notes") <= 500)
);

CREATE INDEX "SaleLocator_saleId_createdAt_idx" ON "SaleLocator"("saleId", "createdAt");
CREATE INDEX "SaleLocator_serviceId_idx" ON "SaleLocator"("serviceId");
-- Same code can be used by different issuers or in a different OS.
CREATE UNIQUE INDEX "SaleLocator_exact_code_per_issuer_key"
  ON "SaleLocator"("saleId", "source", btrim("code"), lower(coalesce(nullif(btrim("issuerName"), ''), '')));

ALTER TABLE "SaleLocator" ADD CONSTRAINT "SaleLocator_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleLocator" ADD CONSTRAINT "SaleLocator_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleLocator" ADD CONSTRAINT "SaleLocator_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
