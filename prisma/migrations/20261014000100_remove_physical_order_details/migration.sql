DROP TABLE "FlightSegment";
DROP TABLE "SalePriceLine";
DROP TYPE "PassengerCategory";

ALTER TABLE "Sale" DROP COLUMN "requestedAt", DROP COLUMN "contactName",
  DROP COLUMN "holderName", DROP COLUMN "billingName", DROP COLUMN "billingDocument",
  DROP COLUMN "billingPhone", DROP COLUMN "billingAddress", DROP COLUMN "billingCity";

ALTER TABLE "Service" DROP CONSTRAINT "Service_supplierId_fkey";
ALTER TABLE "Service" DROP COLUMN "supplierId", DROP COLUMN "route", DROP COLUMN "planType",
  DROP COLUMN "baggage", DROP COLUMN "transportCompany", DROP COLUMN "hotelName";
