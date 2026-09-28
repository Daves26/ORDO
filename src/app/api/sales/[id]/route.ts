import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";
import { parseDate, registrationGaps, saleDraftSchema } from "@/lib/validation";
import { portfolio } from "@/lib/portfolio";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE));
    const { id } = await params;
    const sale = await db.sale.findUnique({ where: { id }, include: {
      customer: true, advisor: { select: { name: true } }, payments: { include: {
        receipt: { select: { number: true } },
        corrections: { orderBy: { createdAt: "desc" }, select: { previousAmount: true, newAmount: true, createdAt: true, reason: true, actor: { select: { name: true } } } },
      }, orderBy: { createdAt: "desc" } },
      receipts: { select: { id: true, number: true, paymentId: true } },
      tasks: { orderBy: { createdAt: "desc" } }, passengers: { include: { passenger: true } },
    } });
    if (!sale) throw new AppError(404, "Venta no encontrada.");
    if (!hasRole(actor, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE) && sale.advisorId !== actor.id) throw new AppError(403, "No tienes acceso a este expediente.");
    if (!hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD)) {
      const { total, customerDueAt, payments, receipts, ...operationalSale } = sale;
      return NextResponse.json({ sale: { ...operationalSale, customer: { id: sale.customer.id, firstName: sale.customer.firstName, lastName: sale.customer.lastName }, payments: [], tasks: sale.tasks.filter((task) => task.assignedRole === "BACK_OFFICE") }, gaps: [] });
    }
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
    const { status: portfolioStatus, ...amounts } = portfolio(Number(sale.total), sale.payments, sale.customerDueAt, today);
    return NextResponse.json({ sale, ...amounts, portfolioStatus, gaps: registrationGaps(sale) });
  } catch (error) { return respond(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.ASESOR, RoleCode.GERENTE), true);
    const { id } = await params;
    const input = saleDraftSchema.parse(await payload(request));
    const updated = await db.$transaction(async (tx) => {
      const old = await tx.sale.findUnique({ where: { id }, include: { payments: { where: { status: { in: ["VALIDADO", "REPORTADO"] } }, select: { amount: true } }, invoices: { select: { id: true }, take: 1 } } });
      if (!old) throw new AppError(404, "Venta no encontrada.");
      if (old.advisorId !== actor.id && !hasRole(actor, RoleCode.GERENTE)) throw new AppError(403, "No puedes editar esta venta.");
      if (old.commercialStatus !== "BORRADOR") throw new AppError(409, "Los cambios posteriores al registro requieren un proceso de modificación controlado.");
      if (old.version !== input.version) throw new AppError(409, "Otra persona modificó esta venta. Recarga el expediente antes de guardar.");
      if (old.invoices.length) throw new AppError(409, "Una venta facturada requiere autorización y snapshot histórico.");
      const committed = old.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      if (input.total < committed) throw new AppError(422, "El valor no puede ser menor a los cobros registrados o pendientes.");
      const sale = await tx.sale.update({ where: { id, version: input.version }, data: { destination: input.destination, startsAt: parseDate(input.startsAt), endsAt: parseDate(input.endsAt), customerDueAt: parseDate(input.customerDueAt), expectedPassengers: input.expectedPassengers, total: input.total, version: { increment: 1 } } });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "Sale", entityId: id, action: "ACTUALIZAR_BORRADOR", before: { destination: old.destination, startsAt: old.startsAt?.toISOString(), endsAt: old.endsAt?.toISOString(), total: old.total.toString() }, after: { destination: sale.destination, startsAt: sale.startsAt?.toISOString(), endsAt: sale.endsAt?.toISOString(), total: sale.total.toString() } } });
      return sale;
    }, { maxWait: 10_000, timeout: 10_000 });
    return NextResponse.json({ version: updated.version });
  } catch (error) { return respond(error); }
}
