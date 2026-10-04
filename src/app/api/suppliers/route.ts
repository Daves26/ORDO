import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await authorize(request, (actor) => hasRole(actor, RoleCode.ASESOR, RoleCode.BACK_OFFICE, RoleCode.CONTABILIDAD, RoleCode.GERENTE));
    const suppliers = await db.supplier.findMany({ where: { active: true }, select: { id: true, name: true }, orderBy: { name: "asc" }, take: 500 });
    return NextResponse.json({ suppliers });
  } catch (error) { return respond(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.ASESOR, RoleCode.BACK_OFFICE, RoleCode.GERENTE), true);
    const { name } = z.object({ name: z.string().trim().min(2).max(150) }).parse(await payload(request));
    const supplier = await db.$transaction(async (tx) => {
      const existing = await tx.supplier.findFirst({ where: { name: { equals: name, mode: "insensitive" } }, select: { id: true, active: true } });
      if (existing) throw new AppError(409, "Este proveedor ya existe. Selecciónalo en la lista.", { id: existing.id });
      const created = await tx.supplier.create({ data: { name } });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "Supplier", entityId: created.id, action: "CREAR", after: { name } } });
      return created;
    });
    return NextResponse.json({ supplier: { id: supplier.id, name: supplier.name } }, { status: 201 });
  } catch (error) { return respond(error); }
}
