import { Prisma, RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";
import { assertCanIssueOrder, orderSnapshot } from "@/lib/order-document";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD), true);
    const { id } = await params;
    const { requestId } = z.object({ requestId: z.string().uuid() }).parse(await payload(request));
    const prior = await db.idempotencyKey.findUnique({ where: { key: requestId } });
    if (prior) {
      const original = await db.saleOrderIssue.findUnique({ where: { id: prior.entityId }, select: { id: true, saleId: true } });
      if (prior.actorId !== actor.id || prior.operation !== "ORDER_ISSUE" || original?.saleId !== id) throw new AppError(409, "Esta solicitud ya fue utilizada.");
      const sale = await db.sale.findUniqueOrThrow({ where: { id }, select: { advisorId: true } });
      assertCanIssueOrder(actor, sale.advisorId);
      return NextResponse.json({ id: original.id, replayed: true });
    }
    const issue = await db.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id }, include: {
        customer: true, advisor: { select: { name: true } }, passengers: { include: { passenger: true } },
        services: { include: { supplier: { select: { name: true } }, flightSegments: { orderBy: { position: "asc" } } } },
        locators: { select: { code: true, source: true, issuerName: true } }, priceLines: true,
        payments: { include: { receipt: { select: { number: true } } }, orderBy: { paidAt: "asc" } },
      } });
      if (!sale) throw new AppError(404, "Orden no encontrada.");
      assertCanIssueOrder(actor, sale.advisorId);
      if (sale.commercialStatus === "CANCELADA") throw new AppError(409, "No se puede emitir una venta cancelada.");
      const snapshot = orderSnapshot(sale) as Prisma.InputJsonValue;
      const created = await tx.saleOrderIssue.create({ data: { saleId: id, createdById: actor.id, snapshot } });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "SaleOrderIssue", entityId: created.id, action: "EMITIR", after: { saleId: id, number: sale.number } } });
      await tx.idempotencyKey.create({ data: { key: requestId, actorId: actor.id, operation: "ORDER_ISSUE", entityId: created.id } });
      return created;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json({ id: issue.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return respond(new AppError(409, "La emisión ya se está procesando. Actualiza el expediente antes de reintentar."));
    return respond(error);
  }
}
