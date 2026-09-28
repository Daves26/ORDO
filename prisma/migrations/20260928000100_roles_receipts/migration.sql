-- Roles of an existing user are updated with optimistic concurrency control.
ALTER TABLE "User" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

-- Null is retained for historical receipt records until they can be reconciled.
ALTER TABLE "Receipt" ADD COLUMN "paymentId" UUID;
CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CustomerPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Case and surrounding spaces may not be used to reuse an accounting receipt number.
CREATE UNIQUE INDEX "Receipt_number_normalized_key" ON "Receipt" (upper(btrim("number")));
