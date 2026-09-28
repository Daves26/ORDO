import { Prisma, RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasRole, isAdministrator } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";
import { parseDate, saleSchema } from "@/lib/validation";
import { saleLabel } from "@/lib/sale-number";

export async function GET(request: Request) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE));
    const own = !hasRole(actor, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE);
    const sales = await db.sale.findMany({
      where: own ? { advisorId: actor.id } : {}, orderBy: { createdAt: "desc" }, take: 50,
      include: { customer: { select: { firstName: true, lastName: true } }, payments: { select: { amount: true, status: true } } },
    });
    const operationalOnly = !hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD);
    return NextResponse.json({ sales: sales.map((sale) => {
      if (operationalOnly) { const { total, customerDueAt, payments, ...rest } = sale; return rest; }
      return { ...sale, balance: Number(sale.total) - sale.payments.filter((p) => p.status === "VALIDADO").reduce((sum, p) => sum + Number(p.amount), 0) };
    }) });
  } catch (error) { return respond(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.ASESOR, RoleCode.GERENTE), true);
    const input = saleSchema.parse(await payload(request));
    const existingRequest = await db.idempotencyKey.findUnique({ where: { key: input.requestId } });
    if (existingRequest) {
      if (existingRequest.actorId !== actor.id || existingRequest.operation !== "SALE_CREATE") throw new AppError(409, "Esta solicitud ya fue utilizada.");
      return NextResponse.json({ id: existingRequest.entityId, replayed: true });
    }
    const customer = await db.customer.findUnique({ where: { id: input.customerId }, select: { id: true } });
    if (!customer) throw new AppError(422, "Selecciona un cliente existente.");
    if (input.advisorId && input.advisorId !== actor.id && !isAdministrator(actor)) throw new AppError(403, "No puedes asignar esta venta a otra persona.");
    const advisorId = input.advisorId ?? actor.id;
    if (advisorId !== actor.id) {
      const advisor = await db.user.findFirst({ where: { id: advisorId, active: true, roles: { some: { role: { code: { in: [RoleCode.ASESOR, RoleCode.GERENTE] } } } } }, select: { id: true } });
      if (!advisor) throw new AppError(422, "Selecciona un asesor activo.");
    }
    const assigned = await db.sale.findUnique({ where: { number: input.orderNumber }, select: { id: true } });
    if (assigned) throw new AppError(409, `${saleLabel(input.orderNumber)} ya está asignada a otra venta.`);
    // El número facilitado por el asesor y la idempotencia se confirman juntos.
    let saleId = "";
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        saleId = await db.$transaction(async (tx) => {
          const sale = await tx.sale.create({ data: {
            number: input.orderNumber,
            customerId: customer.id, advisorId, destination: input.destination,
            serviceType: input.serviceType, startsAt: parseDate(input.startsAt), endsAt: parseDate(input.endsAt),
            customerDueAt: parseDate(input.customerDueAt), total: input.total, currency: "COP",
          } });
          if (input.initialPayment) {
            const payment = await tx.customerPayment.create({ data: { saleId: sale.id, amount: input.initialPayment, currency: "COP", paidAt: new Date(), method: input.paymentMethod!, reportedById: actor.id } });
            await tx.task.create({ data: { saleId: sale.id, paymentId: payment.id, type: "VALIDAR_PAGO", assignedRole: RoleCode.CONTABILIDAD, description: "Validar abono reportado" } });
          }
          await tx.auditLog.create({ data: { actorId: actor.id, entity: "Sale", entityId: sale.id, action: "CREAR_BORRADOR", after: { orderNumber: sale.number, advisorId, total: input.total, customerId: customer.id, initialPayment: input.initialPayment } } });
          await tx.idempotencyKey.create({ data: { key: input.requestId, actorId: actor.id, operation: "SALE_CREATE", entityId: sale.id } });
          return sale.id;
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 10_000 });
        break;
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2028") && attempt < 2) continue;
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
          const duplicate = await db.idempotencyKey.findUnique({ where: { key: input.requestId } });
          if (duplicate?.actorId === actor.id && duplicate.operation === "SALE_CREATE") return NextResponse.json({ id: duplicate.entityId, replayed: true });
          if (await db.sale.findUnique({ where: { number: input.orderNumber }, select: { id: true } })) throw new AppError(409, `${saleLabel(input.orderNumber)} ya está asignada a otra venta.`);
        }
        throw error;
      }
    }
    return NextResponse.json({ id: saleId }, { status: 201 });
  } catch (error) { return respond(error); }
}
