import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";
import { assertOrderAccess, canEditOrder, orderDetailsSchema } from "@/lib/order-details";
import { parseDate } from "@/lib/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => user.roles.length > 0);
    const { id } = await params;
    const sale = await db.sale.findUnique({ where: { id }, select: { advisorId: true, version: true, passengers: { include: { passenger: true } } } });
    if (!sale) throw new AppError(404, "Orden no encontrada.");
    assertOrderAccess(actor, sale.advisorId);
    return NextResponse.json({ sale: { version: sale.version, passengers: sale.passengers } });
  } catch (error) { return respond(error); }
}

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => user.roles.length > 0, true);
    const { id } = await params;
    const input = orderDetailsSchema.parse(await payload(request));
    const sale = await db.$transaction(async (tx) => {
      const current = await tx.sale.findUnique({ where: { id }, select: { advisorId: true, version: true, commercialStatus: true } });
      if (!current) throw new AppError(404, "Orden no encontrada.");
      if (!canEditOrder(actor, current.advisorId)) throw new AppError(403, "No puedes editar los pasajeros de esta orden.");
      if (current.commercialStatus === "CANCELADA") throw new AppError(409, "No se puede modificar una venta cancelada.");
      if (current.version !== input.version) throw new AppError(409, "Otra persona modificó la orden. Recarga el expediente.");
      const previous = await tx.salePassenger.findMany({ where: { saleId: id }, include: { passenger: true } });
      const before = previous.map(({ passenger }) => passenger);
      const ids: string[] = [];
      const documents = new Set<string>();
      for (const item of input.passengers) {
        const key = item.documentType && item.documentNumber ? `${item.documentType.toUpperCase()}:${item.documentNumber.replace(/[\s.\-]/g, "").toUpperCase()}` : "";
        if (key && documents.has(key)) throw new AppError(422, "Hay dos pasajeros con el mismo documento.");
        if (key) documents.add(key);
        const values = { firstName: item.firstName, lastName: item.lastName, documentType: item.documentType?.toUpperCase() ?? null,
          documentNumber: item.documentNumber?.replace(/[\s.\-]/g, "").toUpperCase() ?? null,
          birthDate: parseDate(item.birthDate), passportNumber: item.passportNumber?.toUpperCase() ?? null, passportExpiry: parseDate(item.passportExpiry) };
        if (item.id && !previous.some(({ passengerId }) => passengerId === item.id)) throw new AppError(422, "El pasajero no pertenece a esta orden.");
        let passengerId = item.id;
        if (passengerId) {
          await tx.passenger.update({ where: { id: passengerId }, data: values });
        } else {
          const existing = values.documentNumber ? await tx.passenger.findFirst({ where: { documentType: values.documentType, documentNumber: values.documentNumber } }) : null;
          if (existing && (existing.firstName.toLocaleLowerCase() !== values.firstName.toLocaleLowerCase() || existing.lastName.toLocaleLowerCase() !== values.lastName.toLocaleLowerCase())) throw new AppError(409, "Ese documento corresponde a otro pasajero. Comprueba los nombres.");
          passengerId = existing?.id ?? (await tx.passenger.create({ data: values })).id;
          if (existing) await tx.passenger.update({ where: { id: existing.id }, data: values });
        }
        if (ids.includes(passengerId)) throw new AppError(422, "No agregues dos veces al mismo pasajero.");
        ids.push(passengerId);
        await tx.salePassenger.upsert({ where: { saleId_passengerId: { saleId: id, passengerId } }, update: {}, create: { saleId: id, passengerId } });
      }
      await tx.salePassenger.deleteMany({ where: { saleId: id, passengerId: { notIn: ids } } });
      const detached = previous.map(({ passengerId }) => passengerId).filter((passengerId) => !ids.includes(passengerId));
      if (detached.length) await tx.passenger.deleteMany({ where: { id: { in: detached }, sales: { none: {} } } });
      const updated = await tx.sale.update({ where: { id, version: input.version }, data: { version: { increment: 1 } } });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "Sale", entityId: id, action: "ACTUALIZAR_PASSENGERS", before: JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue, after: JSON.parse(JSON.stringify(input.passengers)) as Prisma.InputJsonValue } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 15_000 });
    return NextResponse.json({ version: sale.version });
  } catch (error) { return respond(error); }
}
