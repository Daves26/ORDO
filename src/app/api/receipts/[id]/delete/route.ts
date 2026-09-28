import { Prisma, RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };
const adminOnly = (actor: { roles: RoleCode[] }) => actor.roles.includes(RoleCode.ADMINISTRADOR);
const inputSchema = z.object({ confirm: z.string(), fingerprint: z.string() });

async function preview(reader: typeof db | Prisma.TransactionClient, id: string) {
  const receipt = await reader.receipt.findUnique({ where: { id }, select: { number: true, paymentId: true, amount: true, voidedAt: true } });
  if (!receipt) throw new AppError(404, "Recibo no encontrado.");
  if (receipt.paymentId) throw new AppError(409, "Este recibo está vinculado a un abono. Elimínalos juntos desde el expediente.");
  return { label: `Recibo de caja ${receipt.number}`, confirmation: receipt.number, version: 1,
    details: { recibos: 1 }, fingerprint: JSON.stringify({ id, number: receipt.number, amount: receipt.amount.toString(), voidedAt: receipt.voidedAt }) };
}

export async function GET(request: Request, { params }: Context) {
  try {
    await authorize(request, adminOnly);
    return NextResponse.json(await preview(db, z.string().uuid().parse((await params).id)));
  } catch (error) { return respond(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    await authorize(request, adminOnly, true);
    const id = z.string().uuid().parse((await params).id);
    const input = inputSchema.parse(await payload(request));
    await db.$transaction(async (tx) => {
      const current = await preview(tx, id);
      if (input.confirm !== current.confirmation) throw new AppError(422, "El número de recibo no coincide.");
      if (input.fingerprint !== current.fingerprint) throw new AppError(409, "El recibo cambió. Recarga antes de eliminarlo.");
      await tx.auditLog.deleteMany({ where: { entityId: id } });
      await tx.idempotencyKey.deleteMany({ where: { entityId: id } });
      await tx.receipt.delete({ where: { id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 });
    return NextResponse.json({ deleted: true });
  } catch (error) { return respond(error); }
}
