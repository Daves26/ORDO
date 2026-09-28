import { z } from "zod";
import { formatCustomerText } from "@/lib/customer-format";

export const normalizeDocument = (value: string) => value.trim().toUpperCase().replace(/[\s.\-]/g, "");
export const normalizePhone = (value: string) => value.replace(/[^\d+]/g, "");

export const customerFields = z.object({
  firstName: z.string().trim().min(2, "Escribe el nombre.").max(100).transform((value) => formatCustomerText(value)),
  lastName: z.string().trim().min(2, "Escribe el apellido.").max(100).transform((value) => formatCustomerText(value)),
  phone: z.string().transform(normalizePhone).pipe(z.string().regex(/^\+?\d{7,15}$/, "Ingresa un teléfono válido.")),
  email: z.union([z.string().trim().email("Correo incompleto o inválido."), z.literal("")]).optional().transform((value) => value ? value.toLowerCase() : null),
  documentType: z.string().trim().toUpperCase().max(20).optional().nullable(),
  documentNumber: z.string().optional().nullable(),
  city: z.string().trim().max(100).transform((value) => formatCustomerText(value, "place")).optional().nullable(),
  address: z.string().trim().max(200).transform((value) => formatCustomerText(value, "place")).optional().nullable(),
});
export const customerSchema = customerFields.transform((value) => ({
  ...value,
  documentType: value.documentType || null,
  documentNumber: value.documentNumber ? normalizeDocument(value.documentNumber) : null,
})).refine((value) => !!value.documentType === !!value.documentNumber, { message: "Indica tipo y número de documento juntos.", path: ["documentNumber"] });

const isoDate = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Fecha inválida.")]).optional();
export const saleSchema = z.object({
  customerId: z.string().uuid(),
  advisorId: z.string().uuid().optional(),
  orderNumber: z.string().regex(/^[0-9]{4}$/, "La orden de servicio debe tener exactamente cuatro dígitos."),
  destination: z.string().trim().min(2).max(150),
  serviceType: z.enum(["VUELO", "HOTEL", "TRASLADO", "SEGURO", "EXCURSION", "CRUCERO", "VEHICULO", "PAQUETE", "OTRO"]),
  startsAt: isoDate,
  endsAt: isoDate,
  total: z.number().int().positive().safe(), // COP en pesos enteros; NUMERIC(16,2) en BD
  initialPayment: z.number().int().min(0).safe().default(0),
  paymentMethod: z.string().trim().max(50).optional(),
  customerDueAt: isoDate,
  requestId: z.string().uuid(),
}).superRefine((v, ctx) => {
  if (v.endsAt && v.startsAt && v.endsAt < v.startsAt) ctx.addIssue({ code: "custom", path: ["endsAt"], message: "El regreso no puede ser anterior a la salida." });
  if (v.initialPayment > v.total) ctx.addIssue({ code: "custom", path: ["initialPayment"], message: "El abono no puede superar el total." });
  if (v.initialPayment && !v.paymentMethod) ctx.addIssue({ code: "custom", path: ["paymentMethod"], message: "Indica el medio del abono." });
});

export const saleDraftSchema = z.object({
  version: z.number().int().positive(),
  destination: z.string().trim().min(2).max(150),
  startsAt: isoDate,
  endsAt: isoDate,
  customerDueAt: isoDate,
  total: z.number().int().positive().safe(),
  expectedPassengers: z.number().int().min(1).max(100).nullable().optional(),
}).refine((v) => !v.startsAt || !v.endsAt || v.endsAt >= v.startsAt, { path: ["endsAt"], message: "El regreso no puede ser anterior a la salida." });

export function parseDate(value?: string) {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error("Fecha inválida.");
  return date;
}

export function registrationGaps(sale: { destination: string; serviceType: string; startsAt: Date | null; endsAt: Date | null; total: unknown }) {
  const gaps: string[] = [];
  if (!sale.destination.trim()) gaps.push("Destino");
  if (!sale.serviceType) gaps.push("Tipo de servicio");
  if (!sale.startsAt) gaps.push("Fecha de salida");
  if (!sale.endsAt) gaps.push("Fecha de regreso");
  if (Number(sale.total) <= 0) gaps.push("Valor de venta");
  return gaps;
}
