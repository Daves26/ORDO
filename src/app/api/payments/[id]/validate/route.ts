import { NextResponse } from "next/server";
import { RoleCode } from "@prisma/client";
import { z } from "zod";
import { hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";
import { normalizeReceiptNumber } from "@/lib/receipt";

type Context = { params: Promise<{ id: string }> };
const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("VALIDAR"), version: z.number().int().positive(), receiptNumber: z.string().trim().min(1, "Indica el número de recibo.").max(80).regex(/^[0-9]+$/, "El número de recibo solo admite dígitos.").transform(normalizeReceiptNumber) }),
  z.object({ action: z.literal("RECHAZAR"), version: z.number().int().positive(), reason: z.string().trim().min(3, "Indica el motivo de rechazo.").max(300) }),
]);

export async function POST(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.CONTABILIDAD), true);
    const { id } = await params;
    const input = actionSchema.parse(await payload(request));
    const result = await db.$transaction(async (tx) => {
      const old = await tx.customerPayment.findUnique({ where: { id } });
      if (!old) throw new AppError(404, "Pago no encontrado.");
      if (old.status !== "REPORTADO") throw new AppError(409, "Este pago ya fue procesado.");
      if (old.version !== input.version) throw new AppError(409, "El importe del abono cambió. Recarga el expediente antes de confirmarlo.");
      if (input.action === "VALIDAR") {
        const used = await tx.receipt.findFirst({ where: { number: { equals: input.receiptNumber, mode: "insensitive" } }, select: { id: true } });
        if (used) throw new AppError(409, "Este número de RC ya está asociado a otro abono.");
      }
      const updated = await tx.customerPayment.update({ where: { id, version: input.version, status: "REPORTADO" }, data: { status: input.action === "VALIDAR" ? "VALIDADO" : "RECHAZADO", version: { increment: 1 } } });
      const receipt = input.action === "VALIDAR" ? await tx.receipt.create({ data: {
        paymentId: id, saleId: old.saleId, number: input.receiptNumber, amount: old.amount,
      } }) : null;
      await tx.customerPaymentValidation.create({ data: { paymentId: id, actorId: actor.id, action: input.action, reason: input.action === "RECHAZAR" ? input.reason : undefined } });
      await tx.task.updateMany({ where: { paymentId: id, type: "VALIDAR_PAGO", status: "PENDIENTE" }, data: { status: "COMPLETADA" } });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "CustomerPayment", entityId: id, action: input.action, before: { status: "REPORTADO" }, after: { status: updated.status, ...(receipt ? { amount: old.amount.toString(), receiptNumber: receipt.number, receiptId: receipt.id } : {}) }, reason: input.action === "RECHAZAR" ? input.reason : undefined } });
      return { payment: updated, receipt };
    }, { maxWait: 10_000, timeout: 10_000 });
    return NextResponse.json({ id: result.payment.id, status: result.payment.status, receiptNumber: result.receipt?.number ?? null });
  } catch (error) { return respond(error); }
}
