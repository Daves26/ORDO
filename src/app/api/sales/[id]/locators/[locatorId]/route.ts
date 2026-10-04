import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";
import { canAccessSaleLocators, canCorrectLocator, locatorUpdateSchema } from "@/lib/locator";

type Context = { params: Promise<{ id: string; locatorId: string }> };

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => user.roles.length > 0, true);
    const { id, locatorId } = await params;
    const input = locatorUpdateSchema.parse(await payload(request));
    const result = await db.$transaction(async (tx) => {
      const locator = await tx.saleLocator.findFirst({ where: { id: locatorId, saleId: id }, include: { sale: { select: { advisorId: true } } } });
      if (!locator) throw new AppError(404, "Localizador no encontrado en esta orden.");
      if (!canAccessSaleLocators(actor, locator.sale.advisorId) || !canCorrectLocator(actor, locator.createdById)) throw new AppError(403, "Solo el autor, back office o administración pueden corregir este localizador.");
      if (locator.version !== input.version) throw new AppError(409, "El localizador cambió. Recarga el expediente antes de corregirlo.");
      if (input.serviceId && !await tx.service.findFirst({ where: { id: input.serviceId, saleId: id }, select: { id: true } })) throw new AppError(422, "El servicio seleccionado no pertenece a esta orden.");
      const before = { source: locator.source, code: locator.code, issuerName: locator.issuerName, serviceId: locator.serviceId, notes: locator.notes };
      const next = { source: input.source, code: input.code, issuerName: input.issuerName, serviceId: input.serviceId ?? null, notes: input.notes };
      if (JSON.stringify(before) === JSON.stringify(next)) throw new AppError(409, "No hay cambios en el localizador.");
      const duplicate = await tx.saleLocator.findFirst({ where: {
        saleId: id, id: { not: locatorId }, source: input.source, code: input.code,
        issuerName: input.issuerName ? { equals: input.issuerName, mode: "insensitive" } : null,
      }, select: { id: true } });
      if (duplicate) throw new AppError(409, "Este código ya existe para el mismo emisor en esta OS.", { existingId: duplicate.id });
      const updated = await tx.saleLocator.update({ where: { id: locatorId, version: input.version }, data: { ...next, version: { increment: 1 } } });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "SaleLocator", entityId: locatorId, action: "CORREGIR", before, after: next } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 10_000 });
    return NextResponse.json({ id: result.id, version: result.version });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return respond(new AppError(409, "Este código ya existe para el mismo emisor en esta OS."));
    return respond(error);
  }
}
