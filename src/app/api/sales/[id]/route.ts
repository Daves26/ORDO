import { Prisma, RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";
import { parseDate, registrationGaps, saleDraftSchema } from "@/lib/validation";
import { getSaleView } from "@/lib/sale-view";
import { isSaleServiceType, serviceLabel } from "@/lib/service-types";
import { invalidateReadModels } from "@/lib/invalidate-read-models";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE));
    const { id } = await params;
    return NextResponse.json(await getSaleView(id, actor));
  } catch (error) { return respond(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.ASESOR, RoleCode.GERENTE), true);
    const { id } = await params;
    const input = saleDraftSchema.parse(await payload(request));
    const updated = await db.$transaction(async (tx) => {
      const old = await tx.sale.findUnique({ where: { id }, include: {
        payments: { where: { status: { in: ["VALIDADO", "REPORTADO"] } }, select: { amount: true } },
        invoices: { select: { id: true }, take: 1 },
        services: { include: { reservations: { select: { id: true }, take: 1 }, payables: { select: { id: true }, take: 1 }, locators: { select: { id: true }, take: 1 } } },
      } });
      if (!old) throw new AppError(404, "Venta no encontrada.");
      if (old.advisorId !== actor.id && !hasRole(actor, RoleCode.GERENTE)) throw new AppError(403, "No puedes editar esta venta.");
      if (old.commercialStatus !== "BORRADOR") throw new AppError(409, "Los cambios posteriores al registro requieren un proceso de modificación controlado.");
      if (old.version !== input.version) throw new AppError(409, "Otra persona modificó esta venta. Recarga el expediente antes de guardar.");
      if (old.invoices.length) throw new AppError(409, "Una venta facturada requiere autorización y snapshot histórico.");
      const committed = old.payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      if (input.total < committed) throw new AppError(422, "El valor no puede ser menor a los cobros registrados o pendientes.");
      const removed = input.services ? old.services.filter((service) => !input.services?.some((type) => type === service.type)) : [];
      for (const service of removed) {
        if (!isSaleServiceType(service.type) || service.locator || service.cost !== null || service.salePrice !== null || service.paymentDueAt || service.startsAt || service.endsAt || service.reservationStatus !== "POR_RESERVAR" || service.reservations.length || service.payables.length || service.locators.length || await tx.document.count({ where: { serviceId: service.id } })) {
          throw new AppError(409, `No puedes retirar ${serviceLabel(service.type)}: ya tiene información operativa, documentos o compromisos asociados.`);
        }
      }
      const sale = await tx.sale.update({ where: { id, version: input.version }, data: { destination: input.destination, notes: input.notes ?? old.notes, startsAt: parseDate(input.startsAt), endsAt: parseDate(input.endsAt), customerDueAt: parseDate(input.customerDueAt), expectedPassengers: input.expectedPassengers, total: input.total, version: { increment: 1 } } });
      if (input.services) {
        await tx.service.deleteMany({ where: { id: { in: removed.map((service) => service.id) } } });
        const added = input.services.filter((type) => !old.services.some((service) => service.type === type));
        if (added.length) await tx.service.createMany({ data: added.map((type) => ({ saleId: id, type, name: serviceLabel(type), currency: "COP" })) });
      }
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "Sale", entityId: id, action: "ACTUALIZAR_BORRADOR", before: { destination: old.destination, notes: old.notes, services: old.services.map((service) => service.type), startsAt: old.startsAt?.toISOString(), endsAt: old.endsAt?.toISOString(), total: old.total.toString() }, after: { destination: sale.destination, notes: sale.notes, services: input.services ?? old.services.map((service) => service.type), startsAt: sale.startsAt?.toISOString(), endsAt: sale.endsAt?.toISOString(), total: sale.total.toString() } } });
      return sale;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 10_000 });
    invalidateReadModels();
    return NextResponse.json({ version: updated.version });
  } catch (error) { return respond(error); }
}
