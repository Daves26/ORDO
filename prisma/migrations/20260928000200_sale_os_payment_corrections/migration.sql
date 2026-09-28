-- Historical VEN numbers are kept until their actual OS is recorded by accounting.
-- Every active number is either a four-digit OS or an unchanged legacy identifier.
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_number_four_digit_or_legacy" CHECK (
    "number" ~ '^[0-9]{4}$' OR "number" ~ '^VEN-[0-9]{4}-[0-9]{6}$'
);

ALTER TABLE "CustomerPayment" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE "PaymentAmountCorrection" (
    "id" UUID NOT NULL,
    "paymentId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "receiptId" UUID,
    "previousAmount" DECIMAL(16,2) NOT NULL,
    "newAmount" DECIMAL(16,2) NOT NULL,
    "status" "PaymentStatus" NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PaymentAmountCorrection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PaymentAmountCorrection_positive_values" CHECK ("previousAmount" > 0 AND "newAmount" > 0)
);

CREATE INDEX "PaymentAmountCorrection_paymentId_createdAt_idx" ON "PaymentAmountCorrection"("paymentId", "createdAt");

ALTER TABLE "PaymentAmountCorrection" ADD CONSTRAINT "PaymentAmountCorrection_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "CustomerPayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAmountCorrection" ADD CONSTRAINT "PaymentAmountCorrection_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PaymentAmountCorrection" ADD CONSTRAINT "PaymentAmountCorrection_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
