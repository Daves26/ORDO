import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { AppError } from "@/lib/http";
import { saleLabel } from "@/lib/sale-number";

type Reader = typeof db | Prisma.TransactionClient;
export type DeletionPreview = { label: string; confirmation: string; version: number; details: Record<string, number>; fingerprint: string };

function preview(label: string, confirmation: string, version: number, details: Record<string, number>): DeletionPreview {
  return { label, confirmation, version, details, fingerprint: JSON.stringify({ confirmation, version, details }) };
}

export async function saleDeletionPreview(reader: Reader, id: string) {
  const sale = await reader.sale.findUnique({ where: { id }, select: {
    number: true, version: true, _count: { select: { payments: true, receipts: true, documents: true, services: true, locators: true, tasks: true, invoices: true, passengers: true, comments: true } },
  } });
  if (!sale) throw new AppError(404, "Orden de servicio no encontrada.");
  const [alerts, payables, supplierPayments, expenses, reservations, validations, corrections, payments] = await Promise.all([
    reader.alert.count({ where: { saleId: id } }),
    reader.supplierPayable.count({ where: { service: { saleId: id } } }),
    reader.supplierPayment.count({ where: { payable: { service: { saleId: id } } } }),
    reader.accountingExpense.count({ where: { payment: { payable: { service: { saleId: id } } } } }),
    reader.reservation.count({ where: { service: { saleId: id } } }),
    reader.customerPaymentValidation.count({ where: { payment: { saleId: id } } }),
    reader.paymentAmountCorrection.count({ where: { payment: { saleId: id } } }),
    reader.customerPayment.findMany({ where: { saleId: id }, select: { amount: true, status: true } }),
  ]);
  return preview(saleLabel(sale.number), sale.number, sale.version, {
    ventas: 1, abonos: sale._count.payments, recibos: sale._count.receipts,
    documentos: sale._count.documents, servicios: sale._count.services, localizadores: sale._count.locators,
    tareas: sale._count.tasks, facturas: sale._count.invoices,
    pasajeros: sale._count.passengers, comentarios: sale._count.comments, alertas: alerts,
    reservas: reservations, obligaciones: payables, pagos_proveedor: supplierPayments, egresos: expenses,
    validaciones: validations, correcciones: corrections,
    abonos_validados: payments.filter(({ status }) => status === "VALIDADO").length,
    valor_abonos_COP: payments.reduce((sum, payment) => sum + Number(payment.amount), 0),
    valor_validado_COP: payments.filter(({ status }) => status === "VALIDADO").reduce((sum, payment) => sum + Number(payment.amount), 0),
  });
}

export async function customerDeletionPreview(reader: Reader, id: string) {
  const customer = await reader.customer.findUnique({ where: { id }, select: { code: true, firstName: true, lastName: true, version: true, sales: { select: { id: true } }, _count: { select: { changes: true } } } });
  if (!customer) throw new AppError(404, "Cliente no encontrado.");
  const saleIds = customer.sales.map(({ id }) => id);
  const sales = await Promise.all(saleIds.map((saleId) => saleDeletionPreview(reader, saleId)));
  const details: Record<string, number> = { clientes: 1, cambios_de_cliente: customer._count.changes };
  for (const sale of sales) for (const [name, count] of Object.entries(sale.details)) details[name] = (details[name] ?? 0) + count;
  const result = preview(`${customer.firstName} ${customer.lastName} · ${customer.code}`, customer.code, customer.version, details);
  result.fingerprint = JSON.stringify({ customer: result.fingerprint, sales: sales.map(({ fingerprint }) => fingerprint).sort() });
  return result;
}

export async function paymentDeletionPreview(reader: Reader, id: string) {
  const payment = await reader.customerPayment.findUnique({ where: { id }, include: { receipt: { select: { number: true } }, sale: { select: { number: true } }, _count: { select: { corrections: true, validations: true } } } });
  if (!payment) throw new AppError(404, "Abono no encontrado.");
  const tasks = await reader.task.count({ where: { paymentId: id } });
  return preview(`Abono de ${payment.amount.toString()} COP · ${saleLabel(payment.sale.number)}`, payment.receipt?.number ?? "ELIMINAR", payment.version,
    { abonos: 1, recibos: payment.receipt ? 1 : 0, correcciones: payment._count.corrections, validaciones: payment._count.validations, tareas: tasks });
}

export function assertDeletion(preview: DeletionPreview, input: { confirm: string; fingerprint: string }) {
  if (input.confirm !== preview.confirmation) throw new AppError(422, "El identificador de confirmación no coincide.");
  if (input.fingerprint !== preview.fingerprint) throw new AppError(409, "La información cambió desde que abriste la confirmación. Vuelve a revisar el impacto.");
}
