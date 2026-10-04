import { z } from "zod";
import { RoleCode } from "@prisma/client";
import { hasRole, isAdministrator, type Actor } from "@/lib/auth";
import { LOCATOR_SOURCES, type LocatorSourceCode } from "@/lib/locator-options";

const codes = LOCATOR_SOURCES.map(({ code }) => code) as [LocatorSourceCode, ...LocatorSourceCode[]];
const fields = z.object({
  source: z.enum(codes),
  code: z.string().trim().min(1, "Ingresa el localizador.").max(120).refine((value) => !/[\u0000-\u001f\u007f]/u.test(value), "El código no admite saltos de línea ni caracteres de control."),
  issuerName: z.string().trim().max(120).optional().nullable().transform((value) => value || null),
  serviceId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable().transform((value) => value || null),
});
function described(value: z.infer<typeof fields>, ctx: z.RefinementCtx) {
  if (value.source === "OTRO" && !value.issuerName && !value.notes) ctx.addIssue({ code: "custom", path: ["issuerName"], message: "Para Otro indica el emisor o una observación." });
}
export const locatorCreateSchema = fields.extend({ requestId: z.string().uuid() }).superRefine(described);
export const locatorUpdateSchema = fields.extend({ version: z.number().int().positive() }).superRefine(described);

export function canAccessSaleLocators(actor: Actor, advisorId: string) {
  return hasRole(actor, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE) ||
    (actor.id === advisorId && hasRole(actor, RoleCode.ASESOR));
}

export function canCorrectLocator(actor: Actor, creatorId: string) {
  return creatorId === actor.id || actor.roles.includes(RoleCode.BACK_OFFICE) || isAdministrator(actor);
}
