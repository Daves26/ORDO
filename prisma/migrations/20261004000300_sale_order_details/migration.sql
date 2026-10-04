CREATE TYPE "PassengerCategory" AS ENUM ('ADULTO', 'NINO', 'INFANTE');

ALTER TABLE "Passenger" ADD COLUMN "birthDate" DATE, ADD COLUMN "passportNumber" TEXT;
ALTER TABLE "Sale" ADD COLUMN "requestedAt" DATE, ADD COLUMN "contactName" TEXT,
  ADD COLUMN "holderName" TEXT, ADD COLUMN "billingName" TEXT,
  ADD COLUMN "billingDocument" TEXT, ADD COLUMN "billingPhone" TEXT,
  ADD COLUMN "billingAddress" TEXT, ADD COLUMN "billingCity" TEXT;
ALTER TABLE "Service" ADD COLUMN "route" TEXT, ADD COLUMN "planType" TEXT,
  ADD COLUMN "baggage" TEXT, ADD COLUMN "transportCompany" TEXT, ADD COLUMN "hotelName" TEXT;

CREATE TABLE "FlightSegment" (
  "id" UUID NOT NULL, "serviceId" UUID NOT NULL, "position" INTEGER NOT NULL,
  "airline" TEXT NOT NULL, "departureDate" DATE NOT NULL, "arrivalDate" DATE,
  "origin" TEXT NOT NULL, "destination" TEXT NOT NULL,
  "departureTime" TEXT NOT NULL, "arrivalTime" TEXT NOT NULL, "cabinClass" TEXT,
  CONSTRAINT "FlightSegment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "FlightSegment_serviceId_position_key" UNIQUE ("serviceId", "position"),
  CONSTRAINT "FlightSegment_position_valid" CHECK ("position" >= 0),
  CONSTRAINT "FlightSegment_dates_valid" CHECK ("arrivalDate" IS NULL OR "arrivalDate" >= "departureDate")
);
ALTER TABLE "FlightSegment" ADD CONSTRAINT "FlightSegment_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SalePriceLine" (
  "id" UUID NOT NULL, "saleId" UUID NOT NULL, "category" "PassengerCategory" NOT NULL,
  "quantity" INTEGER NOT NULL, "unitPrice" DECIMAL(16,2) NOT NULL,
  CONSTRAINT "SalePriceLine_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SalePriceLine_saleId_category_key" UNIQUE ("saleId", "category"),
  CONSTRAINT "SalePriceLine_amount_valid" CHECK ("quantity" > 0 AND "unitPrice" >= 0)
);
ALTER TABLE "SalePriceLine" ADD CONSTRAINT "SalePriceLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "SaleOrderIssue" (
  "id" UUID NOT NULL, "saleId" UUID NOT NULL, "createdById" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "snapshot" JSONB NOT NULL,
  CONSTRAINT "SaleOrderIssue_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SaleOrderIssue_saleId_createdAt_idx" ON "SaleOrderIssue"("saleId", "createdAt");
ALTER TABLE "SaleOrderIssue" ADD CONSTRAINT "SaleOrderIssue_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SaleOrderIssue" ADD CONSTRAINT "SaleOrderIssue_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
