import { Prisma, RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";
import { isOrderNumber, saleLabel } from "@/lib/sale-number";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  orderNumber: z.string().regex(/^[0-9]{4}$/, "La orden de servicio debe tener exactamente cuatro dígitos."),
  version: z.number().int().positive(),
  reason: z.string().trim().min(3, "Indica el motivo de la corrección.").max(300),
});

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.CONTABILIDAD), true);
    const { id } = await params;
    const input = schema.parse(await payload(request));
    const sale = await db.$transaction(async (tx) => {
      const before = await tx.sale.findUnique({ where: { id }, select: { number: true, version: true } });
      if (!before) throw new AppError(404, "Venta no encontrada.");
      if (before.version !== input.version) throw new AppError(409, "La venta fue modificada. Recarga el expediente antes de corregir la OS.");
      if (before.number === input.orderNumber) throw new AppError(409, "La OS ya tiene ese número.");
      const used = await tx.sale.findUnique({ where: { number: input.orderNumber }, select: { id: true } });
      if (used) throw new AppError(409, `${saleLabel(input.orderNumber)} ya está asignada a otra venta.`);
      const updated = await tx.sale.update({ where: { id, version: input.version }, data: { number: input.orderNumber, version: { increment: 1 } } });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "Sale", entityId: id, action: isOrderNumber(before.number) ? "CORREGIR_OS" : "ASIGNAR_OS", before: { number: before.number }, after: { number: updated.number }, reason: input.reason } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 10_000 });
    return NextResponse.json({ number: sale.number, version: sale.version });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return respond(new AppError(409, "Esta OS ya está asignada a otra venta."));
    return respond(error);
  }
}
