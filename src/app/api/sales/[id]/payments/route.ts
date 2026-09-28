import { Prisma, RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";

const schema = z.object({ amount: z.number().int().positive().safe(), method: z.enum(["TRANSFERENCIA", "EFECTIVO", "TARJETA", "CONSIGNACION", "OTRO"]), requestId: z.string().uuid() });
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD), true);
    const { id } = await params; const input = schema.parse(await payload(request));
    const prior = await db.idempotencyKey.findUnique({ where: { key: input.requestId } });
    if (prior) {
      if (prior.actorId !== actor.id || prior.operation !== "PAYMENT_REPORT") throw new AppError(409, "Solicitud ya utilizada.");
      return NextResponse.json({ id: prior.entityId, replayed: true });
    }
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const payment = await db.$transaction(async (tx) => {
          const sale = await tx.sale.findUnique({ where: { id }, include: { payments: { where: { status: { in: ["REPORTADO", "VALIDADO"] } } } } });
          if (!sale || sale.commercialStatus === "CANCELADA") throw new AppError(404, "Venta no disponible.");
          if (sale.advisorId !== actor.id && !hasRole(actor, RoleCode.GERENTE, RoleCode.CONTABILIDAD)) throw new AppError(403, "Solo puedes reportar pagos de tus ventas.");
          const committed = sale.payments.reduce((sum, p) => sum + Number(p.amount), 0);
          if (committed + input.amount > Number(sale.total)) throw new AppError(422, "El abono supera el saldo restante, incluyendo pagos por validar.");
          const created = await tx.customerPayment.create({ data: { saleId: id, amount: input.amount, method: input.method, paidAt: new Date(), reportedById: actor.id } });
          await tx.task.create({ data: { saleId: id, paymentId: created.id, type: "VALIDAR_PAGO", assignedRole: RoleCode.CONTABILIDAD, description: `Validar abono de ${input.amount.toLocaleString("es-CO")} COP` } });
          await tx.auditLog.create({ data: { actorId: actor.id, entity: "CustomerPayment", entityId: created.id, action: "REPORTAR", after: { saleId: id, amount: input.amount, method: input.method } } });
          await tx.idempotencyKey.create({ data: { key: input.requestId, actorId: actor.id, operation: "PAYMENT_REPORT", entityId: created.id } });
          return created;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 10_000 });
        return NextResponse.json({ id: payment.id }, { status: 201 });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2028") && attempt < 2) continue;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const duplicate = await db.idempotencyKey.findUnique({ where: { key: input.requestId } });
          if (duplicate?.actorId === actor.id && duplicate.operation === "PAYMENT_REPORT") return NextResponse.json({ id: duplicate.entityId, replayed: true });
        }
        throw error;
      }
    }
    throw new AppError(409, "La operación cambió durante el registro. Reintenta.");
  } catch (error) { return respond(error); }
}
