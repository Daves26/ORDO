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
export const orderDetailsSchema = z.object({ section: z.literal("passengers"), version: z.number().int().positive(), passengers: z.array(passenger).max(100) }).strict();

export function canEditOrder(actor: Actor, advisorId: string) {
  if (actor.roles.includes(RoleCode.ADMINISTRADOR) || actor.roles.includes(RoleCode.GERENTE)) return true;
  if (actor.roles.includes(RoleCode.ASESOR) && actor.id === advisorId) return true;
  return actor.roles.includes(RoleCode.BACK_OFFICE);
}

export function canReadOrder(actor: Actor, advisorId: string) {
  return hasRole(actor, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE) || (actor.roles.includes(RoleCode.ASESOR) && actor.id === advisorId);
}

export function assertOrderAccess(actor: Actor, advisorId: string) {
  if (!canReadOrder(actor, advisorId)) throw new AppError(403, "No tienes acceso a esta orden.");
}
