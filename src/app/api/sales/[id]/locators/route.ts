import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";
import { canAccessSaleLocators, locatorCreateSchema } from "@/lib/locator";

type Context = { params: Promise<{ id: string }> };
const duplicateMessage = "Este código ya está registrado para el mismo emisor en esta OS.";

export async function GET(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => user.roles.length > 0);
    const { id } = await params;
    const sale = await db.sale.findUnique({ where: { id }, select: { advisorId: true } });
    if (!sale) throw new AppError(404, "Orden de servicio no encontrada.");
    if (!canAccessSaleLocators(actor, sale.advisorId)) throw new AppError(403, "No tienes acceso a esta orden.");
    const locators = await db.saleLocator.findMany({ where: { saleId: id }, include: { createdBy: { select: { name: true } }, service: { select: { name: true, type: true } } }, orderBy: { createdAt: "asc" } });
    return NextResponse.json({ locators });
  } catch (error) { return respond(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => user.roles.length > 0, true);
    const { id } = await params;
    const input = locatorCreateSchema.parse(await payload(request));
    const sale = await db.sale.findUnique({ where: { id }, select: { advisorId: true } });
    if (!sale) throw new AppError(404, "Orden de servicio no encontrada.");
    if (!canAccessSaleLocators(actor, sale.advisorId)) throw new AppError(403, "No tienes permiso para agregar localizadores a esta orden.");
    const prior = await db.idempotencyKey.findUnique({ where: { key: input.requestId } });
    if (prior) {
      const original = await db.saleLocator.findUnique({ where: { id: prior.entityId }, select: { saleId: true } });
      if (prior.actorId !== actor.id || prior.operation !== "LOCATOR_CREATE" || original?.saleId !== id) throw new AppError(409, "Esta solicitud ya fue utilizada.");
      return NextResponse.json({ id: prior.entityId, replayed: true });
    }
    const created = await db.$transaction(async (tx) => {
      if (input.serviceId && !await tx.service.findFirst({ where: { id: input.serviceId, saleId: id }, select: { id: true } })) {
        throw new AppError(422, "El servicio seleccionado no pertenece a esta orden.");
      }
      const duplicate = await tx.saleLocator.findFirst({ where: {
        saleId: id, source: input.source, code: input.code,
        issuerName: input.issuerName ? { equals: input.issuerName, mode: "insensitive" } : null,
      }, select: { id: true } });
      if (duplicate) throw new AppError(409, duplicateMessage, { existingId: duplicate.id });
      const locator = await tx.saleLocator.create({ data: {
        saleId: id, serviceId: input.serviceId ?? null, source: input.source,
        issuerName: input.issuerName, code: input.code, notes: input.notes, createdById: actor.id,
      } });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "SaleLocator", entityId: locator.id, action: "CREAR", after: { saleId: id, serviceId: locator.serviceId, source: locator.source, issuerName: locator.issuerName, code: locator.code, notes: locator.notes } } });
      await tx.idempotencyKey.create({ data: { key: input.requestId, actorId: actor.id, operation: "LOCATOR_CREATE", entityId: locator.id } });
      return locator;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 10_000 });
    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return respond(new AppError(409, duplicateMessage));
    return respond(error);
  }
}
