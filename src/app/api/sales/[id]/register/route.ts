import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, authorize, respond } from "@/lib/http";
import { registrationGaps } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.ASESOR, RoleCode.GERENTE), true);
    const { id } = await params;
    const updated = await db.$transaction(async (tx) => {
      const sale = await tx.sale.findUnique({ where: { id }, include: { services: { select: { type: true } } } });
      if (!sale) throw new AppError(404, "Venta no encontrada.");
      if (sale.advisorId !== actor.id && !hasRole(actor, RoleCode.GERENTE)) throw new AppError(403, "Solo el asesor responsable puede registrar la venta.");
      if (sale.commercialStatus !== "BORRADOR") throw new AppError(409, "La venta ya no está en borrador.");
      const gaps = registrationGaps(sale);
      if (gaps.length) throw new AppError(422, "Completa la información antes de registrar la venta.", { gaps });
      const result = await tx.sale.update({ where: { id, version: sale.version }, data: { commercialStatus: "REGISTRADA", registeredAt: new Date(), version: { increment: 1 } } });
      await tx.task.create({ data: { saleId: id, type: "INICIAR_GESTION", assignedRole: RoleCode.BACK_OFFICE, description: "Iniciar gestión de reservas" } });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "Sale", entityId: id, action: "REGISTRAR", before: { commercialStatus: "BORRADOR" }, after: { commercialStatus: "REGISTRADA" } } });
      return result;
    });
    return NextResponse.json({ sale: updated });
  } catch (error) { return respond(error); }
}
