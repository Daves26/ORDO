import { Prisma, RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  amount: z.number().int().positive().safe(),
  version: z.number().int().positive(),
  reason: z.string().trim().min(3, "Indica el motivo de la corrección.").max(300),
});

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.CONTABILIDAD), true);
    const { id } = await params;
    const input = schema.parse(await payload(request));
    const result = await db.$transaction(async (tx) => {
      const before = await tx.customerPayment.findUnique({ where: { id }, include: {
        receipt: true,
        sale: { include: { payments: { where: { status: { in: ["VALIDADO", "REPORTADO"] } }, select: { id: true, amount: true } } } },
      } });
      if (!before) throw new AppError(404, "Abono no encontrado.");
      if (before.version !== input.version) throw new AppError(409, "Otra persona modificó el abono. Recarga el expediente antes de corregirlo.");
      if (before.status !== "REPORTADO" && before.status !== "VALIDADO") throw new AppError(409, "Solo se pueden corregir abonos reportados o validados.");
      if (before.sale.commercialStatus === "CANCELADA") throw new AppError(409, "La venta cancelada requiere un proceso de reversión, no una corrección de importe.");
      if (before.amount.equals(input.amount)) throw new AppError(409, "El nuevo valor coincide con el actual.");
      if (before.receipt?.voidedAt) throw new AppError(409, "Un recibo anulado no se puede modificar.");

      const committedElsewhere = before.sale.payments.filter((payment) => payment.id !== id)
        .reduce((sum, payment) => sum.plus(payment.amount), new Prisma.Decimal(0));
      if (committedElsewhere.plus(input.amount).gt(before.sale.total)) {
        throw new AppError(422, "El nuevo abono supera el saldo disponible, incluidos los pagos por validar.");
      }

      const payment = await tx.customerPayment.update({ where: { id, version: input.version }, data: { amount: input.amount, version: { increment: 1 } } });
      if (before.receipt) await tx.receipt.update({ where: { id: before.receipt.id }, data: { amount: input.amount } });
      await tx.paymentAmountCorrection.create({ data: {
        paymentId: id, actorId: actor.id, receiptId: before.receipt?.id,
        previousAmount: before.amount, newAmount: input.amount, status: before.status, reason: input.reason,
      } });
      if (before.status === "REPORTADO") {
        await tx.task.updateMany({ where: { paymentId: id, type: "VALIDAR_PAGO", status: "PENDIENTE" }, data: { description: `Validar abono de ${input.amount.toLocaleString("es-CO")} COP` } });
      }
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "CustomerPayment", entityId: id, action: "CORREGIR_VALOR", before: { amount: before.amount.toString(), receiptAmount: before.receipt?.amount.toString() ?? null }, after: { amount: payment.amount.toString(), receiptAmount: before.receipt ? payment.amount.toString() : null, receiptNumber: before.receipt?.number ?? null }, reason: input.reason } });
      return { payment, receiptNumber: before.receipt?.number ?? null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 10_000 });
    return NextResponse.json({ id: result.payment.id, amount: result.payment.amount.toString(), version: result.payment.version, receiptNumber: result.receiptNumber });
  } catch (error) { return respond(error); }
}
