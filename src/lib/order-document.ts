import { RoleCode } from "@prisma/client";
import type { Actor } from "@/lib/auth";
import { hasRole } from "@/lib/auth";
import { AppError } from "@/lib/http";

export function assertCanIssueOrder(actor: Actor, advisorId: string) {
  if (!hasRole(actor, RoleCode.GERENTE, RoleCode.CONTABILIDAD) && !(actor.roles.includes(RoleCode.ASESOR) && actor.id === advisorId)) {
    throw new AppError(403, "No tienes permiso para emitir esta orden con información financiera.");
  }
}

export function orderSnapshot(sale: {
  number: string; requestedAt: Date | null; contactName: string | null; holderName: string | null;
  billingName: string | null; billingDocument: string | null; billingPhone: string | null;
  billingAddress: string | null; billingCity: string | null; destination: string; notes: string | null;
  startsAt: Date | null; endsAt: Date | null; customerDueAt: Date | null; total: { toString(): string };
  customer: { firstName: string; lastName: string; documentNumber: string | null; phone: string; email: string | null; address: string | null; city: string | null; billingName: string | null; billingDocument: string | null };
  advisor: { name: string };
  passengers: { passenger: { firstName: string; lastName: string; documentType: string | null; documentNumber: string | null; birthDate: Date | null; passportNumber: string | null; passportExpiry: Date | null } }[];
  services: { type: string; name: string; route: string | null; planType: string | null; baggage: string | null; transportCompany: string | null; hotelName: string | null; supplier: { name: string } | null;
    flightSegments: { airline: string; departureDate: Date; arrivalDate: Date | null; origin: string; destination: string; departureTime: string; arrivalTime: string; cabinClass: string | null }[] }[];
  locators: { code: string; source: string; issuerName: string | null }[];
  priceLines: { category: string; quantity: number; unitPrice: { toString(): string } }[];
  payments: { amount: { toString(): string }; status: string; method: string; paidAt: Date; receipt: { number: string } | null }[];
}) {
  const paid = sale.payments.filter((payment) => payment.status === "VALIDADO").reduce((sum, payment) => sum + Number(payment.amount), 0);
  const reported = sale.payments.filter((payment) => payment.status === "REPORTADO").reduce((sum, payment) => sum + Number(payment.amount), 0);
  return JSON.parse(JSON.stringify({
    number: sale.number, requestedAt: sale.requestedAt, contactName: sale.contactName,
    holderName: sale.holderName, billingName: sale.billingName ?? sale.customer.billingName ?? `${sale.customer.firstName} ${sale.customer.lastName}`,
    billingDocument: sale.billingDocument ?? sale.customer.billingDocument ?? sale.customer.documentNumber,
    billingPhone: sale.billingPhone ?? sale.customer.phone, billingAddress: sale.billingAddress ?? sale.customer.address,
    billingCity: sale.billingCity ?? sale.customer.city,
    customer: { name: `${sale.customer.firstName} ${sale.customer.lastName}`, phone: sale.customer.phone, email: sale.customer.email },
    advisor: sale.advisor.name, destination: sale.destination, notes: sale.notes,
    startsAt: sale.startsAt, endsAt: sale.endsAt, customerDueAt: sale.customerDueAt, total: sale.total.toString(),
    passengers: sale.passengers.map(({ passenger }) => passenger),
    services: sale.services.map((service) => ({ type: service.type, name: service.name, route: service.route,
      planType: service.planType, baggage: service.baggage, transportCompany: service.transportCompany,
      hotelName: service.hotelName, supplier: service.supplier, flightSegments: service.flightSegments })),
    locators: sale.locators, priceLines: sale.priceLines.map((line) => ({ category: line.category, quantity: line.quantity, unitPrice: line.unitPrice.toString() })),
    payments: sale.payments.map((payment) => ({ amount: payment.amount.toString(), status: payment.status, method: payment.method, paidAt: payment.paidAt, receipt: payment.receipt?.number ?? null })),
    validated: paid, reported, balance: Number(sale.total) - paid,
  }));
}
