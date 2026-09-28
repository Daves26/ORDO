-- Los valores exigibles y todos los movimientos reales se realizan en COP.
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_positive_cop" CHECK ("total" > 0 AND "currency" = 'COP');
ALTER TABLE "CustomerPayment" ADD CONSTRAINT "CustomerPayment_positive_cop" CHECK ("amount" > 0 AND "currency" = 'COP');
ALTER TABLE "Service" ADD CONSTRAINT "Service_cop_nonnegative" CHECK ("currency" = 'COP' AND ("cost" IS NULL OR "cost" >= 0) AND ("salePrice" IS NULL OR "salePrice" >= 0));
ALTER TABLE "SupplierPayable" ADD CONSTRAINT "SupplierPayable_positive_cop" CHECK ("amount" > 0 AND "currency" = 'COP');
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_positive_cop" CHECK ("amount" > 0 AND "currency" = 'COP');
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_positive" CHECK ("amount" > 0);
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_positive" CHECK ("amount" > 0);
