import { RoleCode } from "@prisma/client";
import { hasRole, type Actor } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError } from "@/lib/http";
import { portfolio } from "@/lib/portfolio";
import { registrationGaps } from "@/lib/validation";
import type { SaleView } from "@/lib/sale-view-types";

export async function getSaleView(id: string, actor: Actor): Promise<SaleView> {
  if (!hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE)) throw new AppError(403, "No tienes acceso a este expediente.");
  const financial = hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD);
  const sale = await db.sale.findUnique({ where: { id }, select: {
    id: true, number: true, advisorId: true, destination: true, serviceType: true, notes: true,
    startsAt: true, endsAt: true, total: financial, customerDueAt: financial, version: true, commercialStatus: true,
    customer: { select: { id: true, firstName: true, lastName: true } }, advisor: { select: { name: true } },
    payments: financial ? { select: {
      id: true, amount: true, version: true, status: true, method: true, paidAt: true,
      receipt: { select: { number: true } },
      corrections: { orderBy: { createdAt: "desc" }, select: { previousAmount: true, newAmount: true, createdAt: true, reason: true, actor: { select: { name: true } } } },
    }, orderBy: { createdAt: "desc" } } : false,
    receipts: financial ? { select: { id: true, number: true, paymentId: true } } : false,
    services: { select: { id: true, type: true, name: true }, orderBy: { id: "asc" } },
    locators: { select: { id: true, code: true, source: true, issuerName: true, serviceId: true, notes: true, createdById: true, createdAt: true, version: true,
      createdBy: { select: { name: true } }, service: { select: { name: true, type: true } } }, orderBy: { createdAt: "asc" } },
    tasks: { where: financial ? undefined : { OR: [{ assignedRole: RoleCode.BACK_OFFICE }, { assigneeId: actor.id }] }, select: { id: true, description: true, status: true, assignedRole: true }, orderBy: { createdAt: "desc" } },
    passengers: { select: { passenger: { select: { id: true, firstName: true, lastName: true, documentType: true, documentNumber: true, birthDate: true, passportNumber: true, passportExpiry: true } } } },
  } });
  if (!sale) throw new AppError(404, "Venta no encontrada.");
  if (!hasRole(actor, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE) && sale.advisorId !== actor.id) throw new AppError(403, "No tienes acceso a este expediente.");
  if (!financial) {
    return JSON.parse(JSON.stringify({ sale: { ...sale, payments: [] }, gaps: [] })) as SaleView;
  }
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  const { status: portfolioStatus, ...amounts } = portfolio(Number(sale.total), sale.payments, sale.customerDueAt, today);
  return JSON.parse(JSON.stringify({ sale, ...amounts, portfolioStatus, gaps: registrationGaps(sale) })) as SaleView;
}
