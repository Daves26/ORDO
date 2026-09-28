import { beforeEach, describe, expect, it, vi } from "vitest";
import { RoleCode } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  actor: { id: "user-1", name: "Asesor", email: "u@example.com", roles: ["ASESOR"] as string[] },
  db: { $transaction: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({
  currentUser: async () => mocks.actor,
  sameOrigin: () => true,
  hasRole: (actor: { roles: string[] }, ...roles: string[]) => roles.some((role) => actor.roles.includes(role)),
}));
vi.mock("@/lib/db", () => ({ db: mocks.db }));

import { POST } from "@/app/api/payments/[id]/validate/route";

const request = (value: unknown = { action: "VALIDAR", receiptNumber: "000001", version: 1 }) => new Request("http://localhost/api/payments/payment-1/validate", { method: "POST", headers: { origin: "http://localhost", host: "localhost", "content-type": "application/json" }, body: JSON.stringify(value) });
const context = { params: Promise.resolve({ id: "payment-1" }) };

describe("Autorización y transición financiera", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.actor.roles = [RoleCode.ASESOR]; });
  it("niega validar al asesor sin siquiera abrir una transacción", async () => {
    const response = await POST(request(), context);
    expect(response.status).toBe(403);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
  });
  it("contabilidad valida y registra historial en una transacción", async () => {
    mocks.actor.roles = [RoleCode.CONTABILIDAD];
    const tx = {
      customerPayment: { findUnique: vi.fn().mockResolvedValue({ id: "payment-1", saleId: "sale-1", status: "REPORTADO", version: 1, amount: { toString: () => "2000000" } }), update: vi.fn().mockResolvedValue({ id: "payment-1", status: "VALIDADO" }) },
      receipt: { findFirst: vi.fn().mockResolvedValue(null), create: vi.fn().mockResolvedValue({ id: "receipt-1", number: "000001" }) },
      customerPaymentValidation: { create: vi.fn() }, task: { updateMany: vi.fn() }, auditLog: { create: vi.fn() },
    };
    mocks.db.$transaction.mockImplementation(async (callback) => callback(tx));
    const response = await POST(request(), context);
    expect(response.status).toBe(200);
    expect(tx.customerPayment.update).toHaveBeenCalledWith({ where: { id: "payment-1", status: "REPORTADO", version: 1 }, data: { status: "VALIDADO", version: { increment: 1 } } });
    expect(tx.receipt.create).toHaveBeenCalledWith({ data: { paymentId: "payment-1", saleId: "sale-1", amount: expect.anything(), number: "000001" } });
    expect(tx.customerPaymentValidation.create).toHaveBeenCalledOnce();
    expect(tx.auditLog.create).toHaveBeenCalledOnce();
  });
  it("no abre una transacción si falta el RC y no lo pide al rechazar", async () => {
    mocks.actor.roles = [RoleCode.CONTABILIDAD];
    expect((await POST(request({ action: "VALIDAR" }), context)).status).toBe(422);
    expect((await POST(request({ action: "VALIDAR", receiptNumber: "RC-001", version: 1 }), context)).status).toBe(422);
    expect(mocks.db.$transaction).not.toHaveBeenCalled();
    const tx = {
      customerPayment: { findUnique: vi.fn().mockResolvedValue({ id: "payment-1", saleId: "sale-1", status: "REPORTADO", version: 1 }), update: vi.fn().mockResolvedValue({ id: "payment-1", status: "RECHAZADO" }) },
      task: { updateMany: vi.fn() }, customerPaymentValidation: { create: vi.fn() }, auditLog: { create: vi.fn() },
    };
    mocks.db.$transaction.mockImplementation(async (callback) => callback(tx));
    expect((await POST(request({ action: "RECHAZAR", reason: "Valor incorrecto", version: 1 }), context)).status).toBe(200);
    expect(tx.customerPaymentValidation.create).toHaveBeenCalledWith({ data: { paymentId: "payment-1", actorId: "user-1", action: "RECHAZAR", reason: "Valor incorrecto" } });
  });
  it("rechaza procesar otra vez un movimiento validado", async () => {
    mocks.actor.roles = [RoleCode.CONTABILIDAD];
    const update = vi.fn();
    mocks.db.$transaction.mockImplementation(async (callback) => callback({ customerPayment: { findUnique: async () => ({ status: "VALIDADO" }), update } }));
    const response = await POST(request(), context);
    expect(response.status).toBe(409);
    expect(update).not.toHaveBeenCalled();
  });
});
