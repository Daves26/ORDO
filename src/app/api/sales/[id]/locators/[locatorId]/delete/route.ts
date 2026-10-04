import { Prisma, RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";

type Context = { params: Promise<{ id: string; locatorId: string }> };
const adminOnly = (actor: { roles: RoleCode[] }) => actor.roles.includes(RoleCode.ADMINISTRADOR);
const inputSchema = z.object({ confirm: z.string(), fingerprint: z.string() });

async function preview(reader: typeof db | Prisma.TransactionClient, saleId: string, locatorId: string) {
  const locator = await reader.saleLocator.findFirst({ where: { id: locatorId, saleId }, select: { code: true, source: true, issuerName: true, serviceId: true, notes: true, version: true } });
  if (!locator) throw new AppError(404, "Localizador no encontrado en esta orden.");
  return { label: `Localizador ${locator.code}`, confirmation: locator.code, version: locator.version, details: { localizadores: 1 }, fingerprint: JSON.stringify(locator) };
}

export async function GET(request: Request, { params }: Context) {
  try {
    await authorize(request, adminOnly);
    const { id, locatorId } = await params;
    return NextResponse.json(await preview(db, z.string().uuid().parse(id), z.string().uuid().parse(locatorId)));
  } catch (error) { return respond(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    await authorize(request, adminOnly, true);
    const { id, locatorId } = await params;
    z.string().uuid().parse(id); z.string().uuid().parse(locatorId);
    const input = inputSchema.parse(await payload(request));
    await db.$transaction(async (tx) => {
      const current = await preview(tx, id, locatorId);
      if (input.confirm !== current.confirmation) throw new AppError(422, "El código de confirmación no coincide.");
      if (input.fingerprint !== current.fingerprint) throw new AppError(409, "El localizador cambió. Actualiza el impacto antes de eliminarlo.");
      await tx.auditLog.deleteMany({ where: { entityId: locatorId } });
      await tx.idempotencyKey.deleteMany({ where: { entityId: locatorId } });
      await tx.saleLocator.delete({ where: { id: locatorId } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 10_000 });
    return NextResponse.json({ deleted: true });
  } catch (error) { return respond(error); }
}
