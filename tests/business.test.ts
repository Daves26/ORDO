import { describe, expect, it } from "vitest";
import { RoleCode } from "@prisma/client";
import { hasRole } from "@/lib/auth";
import { portfolio } from "@/lib/portfolio";
import { customerSchema, normalizeDocument, registrationGaps, saleDraftSchema, saleSchema } from "@/lib/validation";
import { saleLabel, saleSearchNumber } from "@/lib/sale-number";

const request = { customerId: crypto.randomUUID(), orderNumber: "0123", destination: "Cancún", services: ["VUELO", "HOTEL"], notes: "Vuelo y hotel", startsAt: "2026-11-15", endsAt: "2026-11-20", total: 8_000_000, initialPayment: 2_000_000, paymentMethod: "TRANSFERENCIA", requestId: crypto.randomUUID() };
describe("Captura e integridad", () => {
  it("normaliza documento y teléfono antes de comprobar coincidencias", () => {
    expect(normalizeDocument(" cc- 10.234 ")).toBe("CC10234");
    const input = customerSchema.parse({ firstName: "Juan", lastName: "Pérez", phone: "300 123 4567", documentType: "CC", documentNumber: "1.234-5" });
    expect(input.phone).toBe("3001234567"); expect(input.documentNumber).toBe("12345");
  });
  it("no acepta documento sin tipo ni correo incompleto", () => {
    expect(customerSchema.safeParse({ firstName: "Juan", lastName: "Pérez", phone: "3001234567", documentNumber: "123" }).success).toBe(false);
    expect(customerSchema.safeParse({ firstName: "Juan", lastName: "Pérez", phone: "3001234567", email: "juan@gmail" }).success).toBe(false);
  });
  it("permite borrador incompleto, pero rechaza regreso anterior y abono excesivo", () => {
    expect(saleSchema.safeParse({ ...request, startsAt: "", endsAt: "" }).success).toBe(true);
    expect(saleSchema.safeParse({ ...request, endsAt: "2026-11-14" }).success).toBe(false);
    expect(saleSchema.safeParse({ ...request, endsAt: "2026-11-15" }).success).toBe(false);
    expect(saleSchema.safeParse({ ...request, initialPayment: 9_000_000 }).success).toBe(false);
    expect(saleSchema.safeParse({ ...request, orderNumber: "123" }).success).toBe(false);
    expect(saleSchema.safeParse({ ...request, orderNumber: "OS 0123" }).success).toBe(false);
    expect(saleSchema.safeParse({ ...request, services: [] }).success).toBe(false);
    expect(saleSchema.safeParse({ ...request, services: ["VUELO", "VUELO"] }).success).toBe(false);
    expect(saleSchema.safeParse({ ...request, services: ["OTRO"], notes: "" }).success).toBe(false);
    expect(saleSchema.safeParse({ ...request, services: ["OTRO"], notes: "Crucero" }).success).toBe(true);
    expect(registrationGaps({ destination: "Cancún", serviceType: null, services: [], total: 8_000_000, startsAt: new Date("2026-11-15"), endsAt: new Date("2026-11-20") })).toContain("Servicios incluidos");
    expect(registrationGaps({ destination: "Cancún", serviceType: null, services: [{ type: "OTRO" }], notes: "", total: 8_000_000, startsAt: new Date("2026-11-15"), endsAt: new Date("2026-11-20") })).toContain("Observaciones: especifica el servicio Otro");
    expect(saleLabel("0123")).toBe("OS 0123");
    expect(saleLabel("VEN-2026-000001")).toContain("OS pendiente");
    expect(saleSearchNumber("OS 0123")).toBe("0123");
    expect(registrationGaps({ destination: "Cancún", serviceType: "HOTEL", total: 8_000_000, startsAt: null, endsAt: null })).toEqual(["Fecha de salida", "Fecha de regreso"]);
    expect(saleDraftSchema.safeParse({ version: 1, destination: "Cancún", startsAt: "2026-11-15", endsAt: "2026-11-14", total: 8_000_000 }).success).toBe(false);
    expect(saleDraftSchema.safeParse({ version: 1, destination: "Cancún", startsAt: "2026-11-15", endsAt: "2026-11-15", total: 8_000_000 }).success).toBe(false);
  });
});

describe("Cartera COP", () => {
  const due = new Date("2026-11-20T00:00:00Z");
  it("no descuenta abonos reportados del saldo contable", () => {
    expect(portfolio(8_000_000, [{ amount: 2_000_000, status: "REPORTADO" }], due, "2026-11-15")).toMatchObject({ balance: 8_000_000, projectedBalance: 6_000_000, status: "PENDIENTE_VALIDACION" });
  });
  it("admite múltiples abonos y excluye anulados y rechazados", () => {
    const payments = [{ amount: 2_000_000, status: "VALIDADO" }, { amount: 3_000_000, status: "VALIDADO" }, { amount: 1_000_000, status: "ANULADO" }, { amount: 500_000, status: "RECHAZADO" }];
    expect(portfolio(8_000_000, payments, due, "2026-11-15")).toMatchObject({ validated: 5_000_000, balance: 3_000_000, status: "PARCIAL" });
    expect(portfolio(8_000_000, payments, due, "2026-11-21").status).toBe("VENCIDA");
    expect(portfolio(8_000_000, [...payments, { amount: 3_000_000, status: "VALIDADO" }], due, "2026-11-21").status).toBe("PAGADA");
  });
});

it("administrador es superusuario sin cambiar los roles de otras personas", () => {
  const actor = { id: "u", name: "Admin", email: "admin@example.com", roles: [RoleCode.ADMINISTRADOR] };
  expect(hasRole(actor, RoleCode.GERENTE, RoleCode.ASESOR)).toBe(true);
  expect(hasRole(actor, RoleCode.CONTABILIDAD)).toBe(true);
  expect(hasRole({ ...actor, roles: [RoleCode.BACK_OFFICE] }, RoleCode.CONTABILIDAD)).toBe(false);
  expect(hasRole({ ...actor, roles: [RoleCode.GERENTE, RoleCode.ASESOR] }, RoleCode.ASESOR)).toBe(true);
});
