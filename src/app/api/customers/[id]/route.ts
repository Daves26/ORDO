import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";
import { customerFields, normalizeDocument, normalizePhone } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE));
    const { id } = await params;
    const customer = await db.customer.findUnique({ where: { id }, include: {
      sales: { select: { id: true, number: true, destination: true, commercialStatus: true, startsAt: true, total: true }, orderBy: { createdAt: "desc" } },
      changes: { orderBy: { createdAt: "desc" }, take: 30 },
    } });
    if (!customer) throw new AppError(404, "Cliente no encontrado.");
    if (!hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD)) {
      return NextResponse.json({ customer: { id: customer.id, code: customer.code, firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone, email: customer.email, sales: customer.sales.map(({ total, ...sale }) => sale) } });
    }
    return NextResponse.json({ customer });
  } catch (error) { return respond(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.ASESOR, RoleCode.GERENTE), true);
    const { id } = await params;
    const { version, ...raw } = customerFields.partial().extend({ version: z.number().int().positive() }).parse(await payload(request));
    const changes = {
      ...raw,
      ...(raw.phone !== undefined ? { phone: normalizePhone(raw.phone) } : {}),
      ...(raw.documentNumber !== undefined ? { documentNumber: raw.documentNumber ? normalizeDocument(raw.documentNumber) : null } : {}),
      ...(raw.email !== undefined ? { email: raw.email?.toLowerCase() || null } : {}),
    };
    const customer = await db.$transaction(async (tx) => {
      const previous = await tx.customer.findUnique({ where: { id } });
      if (!previous) throw new AppError(404, "Cliente no encontrado.");
      if (previous.version !== version) throw new AppError(409, "Otra persona actualizó la ficha. Recarga antes de guardar.");
      if (!!(changes.documentType === undefined ? previous.documentType : changes.documentType) !== !!(changes.documentNumber === undefined ? previous.documentNumber : changes.documentNumber)) throw new AppError(422, "Indica tipo y número de documento juntos.");
      const docType = changes.documentType === undefined ? previous.documentType : changes.documentType;
      const docNumber = changes.documentNumber === undefined ? previous.documentNumber : changes.documentNumber;
      if (docType && docNumber && (docType !== previous.documentType || docNumber !== previous.documentNumber)) {
        const duplicate = await tx.customer.findFirst({ where: { documentType: docType, documentNumber: docNumber, documentCountry: "CO", id: { not: id } }, select: { id: true } });
        if (duplicate) throw new AppError(409, "Ya existe un cliente con este documento.", { existingId: duplicate.id });
      }
      const updated = await tx.customer.update({ where: { id, version }, data: { ...changes, version: { increment: 1 } } });
      for (const [field, next] of Object.entries(changes)) {
        const before = previous[field as keyof typeof previous];
        if (String(before ?? "") !== String(next ?? "")) {
          await tx.customerChange.create({ data: { customerId: id, actorId: actor.id, field, oldValue: before == null ? null : String(before), newValue: next == null ? null : String(next) } });
        }
      }
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "Customer", entityId: id, action: "ACTUALIZAR", before: changes && Object.fromEntries(Object.keys(changes).map((key) => [key, previous[key as keyof typeof previous]?.toString() ?? null])), after: changes } });
      return updated;
    });
    return NextResponse.json({ customer });
  } catch (error) { return respond(error); }
}
