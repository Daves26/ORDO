CREATE INDEX "Sale_advisorId_commercialStatus_createdAt_idx" ON "Sale"("advisorId", "commercialStatus", "createdAt" DESC);
CREATE INDEX "Sale_commercialStatus_createdAt_idx" ON "Sale"("commercialStatus", "createdAt" DESC);
CREATE INDEX "CustomerPayment_status_createdAt_idx" ON "CustomerPayment"("status", "createdAt");
CREATE INDEX "Task_assignedRole_status_createdAt_idx" ON "Task"("assignedRole", "status", "createdAt");
CREATE INDEX "Task_assigneeId_status_createdAt_idx" ON "Task"("assigneeId", "status", "createdAt");
CREATE INDEX "Task_status_createdAt_idx" ON "Task"("status", "createdAt");
