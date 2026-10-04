import { Prisma, RoleCode } from "@prisma/client";
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
    const sale = await db.sale.findUnique({ where: { id }, include: {
      customer: { select: { firstName: true, lastName: true, documentNumber: true, phone: true, address: true, city: true, billingName: true, billingDocument: true } },
      passengers: { include: { passenger: true } }, priceLines: true,
      services: { include: { supplier: true, flightSegments: { orderBy: { position: "asc" } } }, orderBy: { id: "asc" } },
      orderIssues: { select: { id: true, createdAt: true }, orderBy: { createdAt: "desc" } },
    } });
    if (!sale) throw new AppError(404, "Orden no encontrada.");
    assertOrderAccess(actor, sale.advisorId);
    if (actor.roles.includes(RoleCode.BACK_OFFICE) && !actor.roles.some((role) => ([RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.ADMINISTRADOR] as RoleCode[]).includes(role))) {
      const { total, customerDueAt, priceLines, ...operational } = sale;
      return NextResponse.json({ sale: operational });
    }
    return NextResponse.json({ sale });
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
      if (!canEditOrder(actor, current.advisorId, input.section)) throw new AppError(403, "No puedes editar esta sección de la orden.");
      if (current.commercialStatus === "CANCELADA") throw new AppError(409, "No se puede modificar una venta cancelada.");
      if (current.version !== input.version) throw new AppError(409, "Otra persona modificó la orden. Recarga el expediente.");
      let before: unknown;
      let after: unknown;
      if (input.section === "people") {
        const previous = await tx.sale.findUniqueOrThrow({ where: { id } });
        before = Object.fromEntries(["requestedAt", "contactName", "holderName", "billingName", "billingDocument", "billingPhone", "billingAddress", "billingCity"].map((field) => [field, previous[field as keyof typeof previous]]));
        const values = { requestedAt: input.requestedAt || null, contactName: input.contactName, holderName: input.holderName,
          billingName: input.billingName, billingDocument: input.billingDocument, billingPhone: input.billingPhone,
          billingAddress: input.billingAddress, billingCity: input.billingCity };
        after = values;
        await tx.sale.update({ where: { id }, data: { ...values, requestedAt: parseDate(input.requestedAt) } });
      } else if (input.section === "passengers") {
        const previous = await tx.salePassenger.findMany({ where: { saleId: id }, include: { passenger: true } });
        before = previous.map(({ passenger }) => passenger);
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
        after = input.passengers;
      } else if (input.section === "service") {
        const service = await tx.service.findFirst({ where: { id: input.serviceId, saleId: id }, include: { flightSegments: true } });
        if (!service) throw new AppError(422, "El servicio no pertenece a esta orden.");
        if (service.supplierId !== input.supplierId && await tx.supplierPayable.count({ where: { serviceId: service.id } })) throw new AppError(409, "No se puede cambiar el proveedor de un servicio con obligaciones registradas.");
        if (input.supplierId && !await tx.supplier.findFirst({ where: { id: input.supplierId, active: true } })) throw new AppError(422, "Selecciona un proveedor activo.");
        if (service.type !== "VUELO" && input.segments.length) throw new AppError(422, "Los tramos solo pueden asociarse a un servicio de vuelos.");
        before = service;
        after = input;
        await tx.service.update({ where: { id: service.id }, data: { supplierId: input.supplierId, route: input.route, planType: input.planType,
          baggage: input.baggage, transportCompany: input.transportCompany, hotelName: input.hotelName } });
        await tx.flightSegment.deleteMany({ where: { serviceId: service.id } });
        if (input.segments.length) await tx.flightSegment.createMany({ data: input.segments.map((segment, position) => ({
          serviceId: service.id, position, airline: segment.airline, departureDate: parseDate(segment.departureDate)!, arrivalDate: parseDate(segment.arrivalDate),
          origin: segment.origin, destination: segment.destination, departureTime: segment.departureTime, arrivalTime: segment.arrivalTime, cabinClass: segment.cabinClass,
        })) });
      } else {
        before = await tx.salePriceLine.findMany({ where: { saleId: id } });
        after = input.lines;
        await tx.salePriceLine.deleteMany({ where: { saleId: id } });
        if (input.lines.length) await tx.salePriceLine.createMany({ data: input.lines.map((line) => ({ ...line, saleId: id })) });
      }
      const updated = await tx.sale.update({ where: { id, version: input.version }, data: { version: { increment: 1 } } });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "Sale", entityId: id, action: `ACTUALIZAR_${input.section.toUpperCase()}`, before: JSON.parse(JSON.stringify(before)) as Prisma.InputJsonValue, after: JSON.parse(JSON.stringify(after)) as Prisma.InputJsonValue } });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 15_000 });
    return NextResponse.json({ version: sale.version });
  } catch (error) { return respond(error); }
}
