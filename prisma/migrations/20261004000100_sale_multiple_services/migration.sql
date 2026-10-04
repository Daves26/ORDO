-- Preserve historical labels (for example PAQUETE) without inventing included services.
-- New sales store their selected services in Service, not in this legacy column.
ALTER TABLE "Sale" ALTER COLUMN "serviceType" DROP NOT NULL;
