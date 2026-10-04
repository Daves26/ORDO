import type { Prisma } from "@prisma/client";
import { AppError } from "@/lib/http";

type Transaction = Prisma.TransactionClient;

/** Destructive support actions are limited to explicit administrator endpoints. */
export async function deletePaymentGraph(tx: Transaction, id: string) {
  const payment = await tx.customerPayment.findUnique({ where: { id }, include: {
    receipt: { select: { id: true, number: true } },
    validations: { select: { id: true } },
    corrections: { select: { id: true } },
    sale: { select: { id: true, number: true } },
  } });
  if (!payment) throw new AppError(404, "Abono no encontrado.");
  const tasks = await tx.task.findMany({ where: { paymentId: id }, select: { id: true } });
  const identifiers = [id, payment.receipt?.id, ...payment.validations.map(({ id }) => id), ...payment.corrections.map(({ id }) => id), ...tasks.map(({ id }) => id)].filter((value): value is string => !!value);
  await tx.paymentAmountCorrection.deleteMany({ where: { paymentId: id } });
  await tx.customerPaymentValidation.deleteMany({ where: { paymentId: id } });
  await tx.task.deleteMany({ where: { paymentId: id } });
  await tx.receipt.deleteMany({ where: { paymentId: id } });
  await tx.idempotencyKey.deleteMany({ where: { entityId: { in: identifiers } } });
  await tx.auditLog.deleteMany({ where: { entityId: { in: identifiers } } });
  await tx.customerPayment.delete({ where: { id } });
  return payment;
}

export async function deleteSaleGraph(tx: Transaction, id: string) {
  const sale = await tx.sale.findUnique({ where: { id }, include: {
    payments: { select: { id: true } },
    services: { select: { id: true, reservations: { select: { id: true } }, payables: { select: { id: true, payments: { select: { id: true, expense: { select: { id: true } } } } } } } },
    receipts: { select: { id: true } }, invoices: { select: { id: true } }, documents: { select: { id: true } },
    tasks: { select: { id: true } }, comments: { select: { id: true } }, passengers: { select: { passengerId: true } }, locators: { select: { id: true } },
  } });
  if (!sale) throw new AppError(404, "Orden de servicio no encontrada.");
  const serviceIds = sale.services.map(({ id }) => id);
  const payables = sale.services.flatMap(({ payables }) => payables);
  const payableIds = payables.map(({ id }) => id);
  const supplierPayments = payables.flatMap(({ payments }) => payments);
  const identifiers = [id, ...serviceIds, ...sale.services.flatMap(({ reservations }) => reservations.map(({ id }) => id)),
    ...payableIds, ...supplierPayments.map(({ id }) => id), ...supplierPayments.flatMap(({ expense }) => expense ? [expense.id] : []),
    ...sale.receipts.map(({ id }) => id), ...sale.invoices.map(({ id }) => id), ...sale.documents.map(({ id }) => id),
    ...sale.tasks.map(({ id }) => id), ...sale.comments.map(({ id }) => id), ...sale.locators.map(({ id }) => id)];
  const alerts = await tx.alert.findMany({ where: { saleId: id }, select: { id: true } });
  identifiers.push(...alerts.map(({ id }) => id));

  for (const payment of sale.payments) await deletePaymentGraph(tx, payment.id);
  await tx.saleLocator.deleteMany({ where: { saleId: id } });
  await tx.accountingExpense.deleteMany({ where: { supplierPaymentId: { in: supplierPayments.map(({ id }) => id) } } });
  await tx.supplierPayment.deleteMany({ where: { payableId: { in: payableIds } } });
  await tx.supplierPayable.deleteMany({ where: { serviceId: { in: serviceIds } } });
  await tx.reservation.deleteMany({ where: { serviceId: { in: serviceIds } } });
  await tx.service.deleteMany({ where: { saleId: id } });
  await tx.receipt.deleteMany({ where: { saleId: id } });
  await tx.invoice.deleteMany({ where: { saleId: id } });
  await tx.task.deleteMany({ where: { saleId: id } });
  await tx.document.deleteMany({ where: { saleId: id } });
  await tx.comment.deleteMany({ where: { saleId: id } });
  await tx.alert.deleteMany({ where: { saleId: id } });
  await tx.salePassenger.deleteMany({ where: { saleId: id } });
  await tx.passenger.deleteMany({ where: { id: { in: sale.passengers.map(({ passengerId }) => passengerId) }, sales: { none: {} } } });
  await tx.outboxEvent.deleteMany({ where: { OR: [{ payload: { path: ["saleId"], equals: id } }, { payload: { path: ["id"], equals: id } }] } });
  await tx.idempotencyKey.deleteMany({ where: { entityId: { in: identifiers } } });
  await tx.auditLog.deleteMany({ where: { entityId: { in: identifiers } } });
  await tx.sale.delete({ where: { id } });
  return sale;
}

export async function deleteCustomerGraph(tx: Transaction, id: string) {
  const customer = await tx.customer.findUnique({ where: { id }, include: {
    sales: { select: { id: true, number: true } }, changes: { select: { id: true } },
  } });
  if (!customer) throw new AppError(404, "Cliente no encontrado.");
  for (const sale of customer.sales) await deleteSaleGraph(tx, sale.id);
  await tx.auditLog.deleteMany({ where: { entityId: { in: [id, ...customer.changes.map(({ id }) => id)] } } });
  await tx.idempotencyKey.deleteMany({ where: { entityId: id } });
  await tx.customerChange.deleteMany({ where: { customerId: id } });
  await tx.customer.delete({ where: { id } });
  return customer;
}
