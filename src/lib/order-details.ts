import { RoleCode } from "@prisma/client";
import { z } from "zod";
import type { Actor } from "@/lib/auth";
import { hasRole } from "@/lib/auth";
import { AppError } from "@/lib/http";
import { parseDate } from "@/lib/validation";

const optionalText = (max: number) => z.string().trim().max(max).transform((value) => value || null);
const date = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).refine((value) => !value || (() => { const parsed = new Date(`${value}T00:00:00.000Z`); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value; })(), "Fecha inválida.");
const passenger = z.object({
  id: z.string().uuid().optional(), firstName: z.string().trim().min(2).max(100), lastName: z.string().trim().min(2).max(100),
  documentType: optionalText(20), documentNumber: optionalText(40), birthDate: date,
  passportNumber: optionalText(40), passportExpiry: date,
}).refine((item) => !!item.documentType === !!item.documentNumber, { path: ["documentNumber"], message: "Indica tipo y número de documento juntos." });
const segment = z.object({
  airline: z.string().trim().min(1).max(100), departureDate: date.refine(Boolean, "Indica la fecha."),
  arrivalDate: date, origin: z.string().trim().min(2).max(100), destination: z.string().trim().min(2).max(100),
  departureTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa HH:mm."),
  arrivalTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Usa HH:mm."), cabinClass: optionalText(60),
}).refine((item) => !item.arrivalDate || item.arrivalDate >= item.departureDate, { path: ["arrivalDate"], message: "La llegada no puede preceder a la salida." });

export const orderDetailsSchema = z.discriminatedUnion("section", [
  z.object({ section: z.literal("people"), version: z.number().int().positive(), requestedAt: date,
    contactName: optionalText(150), holderName: optionalText(150), billingName: optionalText(150),
    billingDocument: optionalText(40), billingPhone: optionalText(30), billingAddress: optionalText(200), billingCity: optionalText(100) }),
  z.object({ section: z.literal("passengers"), version: z.number().int().positive(), passengers: z.array(passenger).max(100) }),
  z.object({ section: z.literal("service"), version: z.number().int().positive(), serviceId: z.string().uuid(),
    supplierId: z.union([z.string().uuid(), z.null()]), route: optionalText(200), planType: optionalText(120),
    baggage: optionalText(120), transportCompany: optionalText(120), hotelName: optionalText(150),
    segments: z.array(segment).max(30) }),
  z.object({ section: z.literal("prices"), version: z.number().int().positive(), lines: z.array(z.object({
    category: z.enum(["ADULTO", "NINO", "INFANTE"]), quantity: z.number().int().min(1).max(100),
    unitPrice: z.number().int().min(0).max(99_999_999_999_999),
  })).max(3) }),
]).superRefine((input, ctx) => {
  if (input.section === "prices" && new Set(input.lines.map((line) => line.category)).size !== input.lines.length) {
    ctx.addIssue({ code: "custom", path: ["lines"], message: "Un solo precio por tipo de pasajero." });
  }
});

export function canEditOrder(actor: Actor, advisorId: string, section: "people" | "passengers" | "service" | "prices") {
  if (actor.roles.includes(RoleCode.ADMINISTRADOR) || actor.roles.includes(RoleCode.GERENTE)) return true;
  if (actor.roles.includes(RoleCode.ASESOR) && actor.id === advisorId) return true;
  return actor.roles.includes(RoleCode.BACK_OFFICE) && (section === "service" || section === "passengers");
}

export function canReadOrder(actor: Actor, advisorId: string) {
  return hasRole(actor, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE) || (actor.roles.includes(RoleCode.ASESOR) && actor.id === advisorId);
}

export function assertOrderAccess(actor: Actor, advisorId: string) {
  if (!canReadOrder(actor, advisorId)) throw new AppError(403, "No tienes acceso a esta orden.");
}
