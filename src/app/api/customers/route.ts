import { randomUUID } from "node:crypto";
import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";
import { customerSchema, normalizeDocument, normalizePhone } from "@/lib/validation";

const canCreate = (roles: RoleCode[]) => roles.includes(RoleCode.ASESOR) || roles.includes(RoleCode.GERENTE) || roles.includes(RoleCode.ADMINISTRADOR);

export async function GET(request: Request) {
  try {
    await authorize(request, (actor) => hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE));
    const query = new URL(request.url).searchParams.get("q")?.trim().slice(0, 100) ?? "";
    if (query.length < 2) return NextResponse.json({ customers: [] });
    const document = normalizeDocument(query);
    const phone = normalizePhone(query);
    const words = query.split(/\s+/).filter(Boolean);
    const customers = await db.customer.findMany({
      where: { OR: [
        ...(words.length > 1 ? [{ AND: [{ firstName: { contains: words[0], mode: "insensitive" as const } }, { lastName: { contains: words.slice(1).join(" "), mode: "insensitive" as const } }] }] : []),
        { firstName: { contains: query, mode: "insensitive" } },
        { lastName: { contains: query, mode: "insensitive" } },
        { documentNumber: { contains: document, mode: "insensitive" } },
        ...(phone.length >= 4 ? [{ phone: { contains: phone } }] : []),
        { email: { contains: query, mode: "insensitive" } },
      ] },
      select: { id: true, code: true, firstName: true, lastName: true, phone: true, documentType: true, documentNumber: true, email: true, city: true },
      orderBy: { updatedAt: "desc" }, take: 12,
    });
    return NextResponse.json({ customers });
  } catch (error) { return respond(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await authorize(request, (user) => canCreate(user.roles), true);
    const input = customerSchema.parse(await payload(request));
    if (input.documentNumber) {
      const existing = await db.customer.findFirst({ where: { documentType: input.documentType, documentNumber: input.documentNumber, documentCountry: "CO" } });
      if (existing) throw new AppError(409, "Ya existe un cliente con este documento.", { existingId: existing.id });
    }
    const similar = await db.customer.findMany({
      where: { OR: [{ phone: input.phone }, ...(input.email ? [{ email: { equals: input.email, mode: "insensitive" as const } }] : [])] },
      select: { id: true, firstName: true, lastName: true, phone: true, email: true }, take: 5,
    });
    // La advertencia exige confirmación explícita; nunca se crea un duplicado silenciosamente.
    if (similar.length && request.headers.get("x-confirm-similar") !== "true") throw new AppError(409, "Hay posibles clientes duplicados. Revísalos antes de continuar.", { similar });
    const customer = await db.$transaction(async (tx) => {
      const created = await tx.customer.create({ data: {
        ...input, code: `CLI-${randomUUID().slice(0, 12).toUpperCase()}`, createdById: actor.id,
      } });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "Customer", entityId: created.id, action: "CREAR", after: { code: created.code, firstName: created.firstName, lastName: created.lastName } } });
      return created;
    });
    return NextResponse.json({ customer }, { status: 201 });
  } catch (error) { return respond(error); }
}
