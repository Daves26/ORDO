import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient, RoleCode } from "@prisma/client";

const auth = vi.hoisted(() => ({ actor: { id: "", name: "Pruebas", email: "", roles: ["ASESOR"] as string[] } }));
vi.mock("@/lib/auth", () => ({
  currentUser: async () => auth.actor,
  sameOrigin: () => true,
  hasRole: (actor: { roles: string[] }, ...roles: string[]) => roles.some((role) => actor.roles.includes(role)),
}));

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !/(^|[_-])test($|[_-])/i.test(new URL(testUrl).pathname.slice(1)) ||
  (process.env.DATABASE_URL && new URL(testUrl).host === new URL(process.env.DATABASE_URL).host && new URL(testUrl).pathname === new URL(process.env.DATABASE_URL).pathname)) throw new Error("Usa exclusivamente una base de pruebas separada.");
process.env.DATABASE_URL = testUrl;
const db = new PrismaClient({ datasources: { db: { url: testUrl } } });
const body = (value: unknown, url = "http://localhost:3000/api/test") => new Request(url, { method: "POST", headers: { "content-type": "application/json", origin: "http://localhost:3000" }, body: JSON.stringify(value) });

let customerPOST: typeof import("@/app/api/customers/route").POST;
let customerPATCH: typeof import("@/app/api/customers/[id]/route").PATCH;
let salePOST: typeof import("@/app/api/sales/route").POST;
let saleGET: typeof import("@/app/api/sales/[id]/route").GET;
let salePATCH: typeof import("@/app/api/sales/[id]/route").PATCH;
let registerPOST: typeof import("@/app/api/sales/[id]/register/route").POST;
let paymentPOST: typeof import("@/app/api/sales/[id]/payments/route").POST;
let validatePOST: typeof import("@/app/api/payments/[id]/validate/route").POST;
let editRolesPATCH: typeof import("@/app/api/users/[id]/roles/route").PATCH;
let editOrderPATCH: typeof import("@/app/api/sales/[id]/os/route").PATCH;
let correctAmountPATCH: typeof import("@/app/api/payments/[id]/amount/route").PATCH;
let customerId = ""; let saleId = ""; let userId = ""; let orderNumber = "";
const extraUserIds: string[] = [];
const extraSaleIds: string[] = [];

beforeAll(async () => {
  const unique = crypto.randomUUID();
  const user = await db.user.create({ data: { email: `test-${unique}@example.test`, name: "Asesor de integración", passwordHash: "test-only" } });
  userId = user.id; auth.actor.id = user.id; auth.actor.email = user.email;
  ({ POST: customerPOST } = await import("@/app/api/customers/route"));
  ({ PATCH: customerPATCH } = await import("@/app/api/customers/[id]/route"));
  ({ POST: salePOST } = await import("@/app/api/sales/route"));
  ({ GET: saleGET, PATCH: salePATCH } = await import("@/app/api/sales/[id]/route"));
  ({ POST: registerPOST } = await import("@/app/api/sales/[id]/register/route"));
  ({ POST: paymentPOST } = await import("@/app/api/sales/[id]/payments/route"));
  ({ POST: validatePOST } = await import("@/app/api/payments/[id]/validate/route"));
  ({ PATCH: editRolesPATCH } = await import("@/app/api/users/[id]/roles/route"));
  ({ PATCH: editOrderPATCH } = await import("@/app/api/sales/[id]/os/route"));
  ({ PATCH: correctAmountPATCH } = await import("@/app/api/payments/[id]/amount/route"));
});

afterAll(async () => {
  if (userId) {
    await db.auditLog.deleteMany({ where: { actorId: userId } });
    await db.idempotencyKey.deleteMany({ where: { actorId: userId } });
    const saleIds = [saleId, ...extraSaleIds].filter(Boolean);
    const { deleteSaleGraph } = await import("@/lib/hard-delete");
    for (const id of saleIds) if (await db.sale.findUnique({ where: { id } })) await db.$transaction((tx) => deleteSaleGraph(tx, id), { timeout: 30_000 });
    await db.customerChange.deleteMany({ where: { customer: { createdById: userId } } });
    await db.customer.deleteMany({ where: { createdById: userId } });
    await db.userRole.deleteMany({ where: { userId: { in: [userId, ...extraUserIds] } } });
    await db.user.deleteMany({ where: { id: { in: extraUserIds } } });
    await db.user.delete({ where: { id: userId } });
  }
  await db.$disconnect();
});

describe("Expediente con PostgreSQL real", () => {
  it("crea una ficha, bloquea documento repetido y audita edición optimista", async () => {
    const document = `TEST${crypto.randomUUID().replaceAll("-", "").slice(0, 10)}`;
    const data = { firstName: "jUAN", lastName: "pÉREZ", phone: "300 123 4567", email: "JUAN@EXAMPLE.TEST", documentType: "cc", documentNumber: document };
    const response = await customerPOST(body(data));
    expect(response.status).toBe(201);
    const { customer } = await response.json(); customerId = customer.id;
    expect(customer).toMatchObject({ firstName: "Juan", lastName: "Pérez", phone: "3001234567", email: "juan@example.test", documentType: "CC" });
    const repeated = await customerPOST(body({ ...data, phone: "3150000000" }));
    expect(repeated.status).toBe(409);
    expect((await repeated.json()).details.existingId).toBe(customerId);
    const changed = await customerPATCH(new Request("http://localhost:3000/api/customers/" + customerId, { method: "PATCH", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ version: 1, phone: "315 000 0000" }) }), { params: Promise.resolve({ id: customerId }) });
    expect(changed.status).toBe(200);
    const history = await db.customerChange.findFirstOrThrow({ where: { customerId, field: "phone" } });
    expect(history.oldValue).toBe("3001234567"); expect(history.newValue).toBe("3150000000");
    const stale = await customerPATCH(new Request("http://localhost:3000/api/customers/" + customerId, { method: "PATCH", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ version: 1, phone: "3000000000" }) }), { params: Promise.resolve({ id: customerId }) });
    expect(stale.status).toBe(409);
  });

  it("crea una sola venta aunque se reenvíe, completa borrador y controla abonos concurrentes", async () => {
    expect(customerId).toBeTruthy();
    let candidate = 1;
    while (candidate < 10000 && await db.sale.findUnique({ where: { number: String(candidate).padStart(4, "0") }, select: { id: true } })) candidate++;
    orderNumber = String(candidate).padStart(4, "0");
    const input = { customerId, orderNumber, destination: "Cancún", services: ["VUELO", "HOTEL"], notes: "Vuelo y hotel para 2 pasajeros", startsAt: "", endsAt: "", total: 8_000_000, initialPayment: 2_000_000, paymentMethod: "TRANSFERENCIA", requestId: crypto.randomUUID() };
    const first = await salePOST(body(input)); expect(first.status).toBe(201);
    saleId = (await first.json()).id;
    expect((await db.sale.findUniqueOrThrow({ where: { id: saleId } })).number).toBe(orderNumber);
    expect((await db.sale.findUniqueOrThrow({ where: { id: saleId } })).serviceType).toBeNull();
    expect((await db.service.findMany({ where: { saleId }, orderBy: { type: "asc" } })).map((service) => service.type)).toEqual(["HOTEL", "VUELO"]);
    const replay = await salePOST(body(input)); expect(replay.status).toBe(200); expect((await replay.json()).id).toBe(saleId);
    expect(await db.sale.count({ where: { id: saleId } })).toBe(1);
    const initial = await saleGET(new Request("http://localhost:3000/api/sales/" + saleId), { params: Promise.resolve({ id: saleId }) });
    const initialData = await initial.json();
    expect(initialData).toMatchObject({ balance: 8_000_000, projectedBalance: 6_000_000, portfolioStatus: "PENDIENTE_VALIDACION" });
    expect(initialData.gaps).toEqual(["Fecha de salida", "Fecha de regreso"]);
    const paymentId = initialData.sale.payments[0].id;
    const premature = await registerPOST(new Request("http://localhost:3000/api/sales/" + saleId + "/register", { method: "POST", headers: { origin: "http://localhost:3000" } }), { params: Promise.resolve({ id: saleId }) });
    expect(premature.status).toBe(422);
    const edit = { version: 1, destination: "Cancún", notes: "Actualizado en borrador", services: ["VUELO", "HOTEL", "TRASLADO"], startsAt: "2026-11-15", endsAt: "2026-11-20", customerDueAt: "2026-11-30", total: 8_000_000 };
    const editRequest = () => new Request("http://localhost:3000/api/sales/" + saleId, { method: "PATCH", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(edit) });
    const [one, two] = await Promise.all([salePATCH(editRequest(), { params: Promise.resolve({ id: saleId }) }), salePATCH(editRequest(), { params: Promise.resolve({ id: saleId }) })]);
    expect([one.status, two.status].sort()).toEqual([200, 409]);
    expect(await db.service.count({ where: { saleId } })).toBe(3);
    expect((await db.sale.findUniqueOrThrow({ where: { id: saleId } })).notes).toBe("Actualizado en borrador");
    const hotelService = await db.service.findFirstOrThrow({ where: { saleId, type: "HOTEL" } });
    await db.reservation.create({ data: { serviceId: hotelService.id, locator: "PRUEBA123" } });
    const removeConfigured = await salePATCH(new Request(`http://localhost:3000/api/sales/${saleId}`, { method: "PATCH", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ ...edit, version: 2, services: ["VUELO", "TRASLADO"] }) }), { params: Promise.resolve({ id: saleId }) });
    expect(removeConfigured.status).toBe(409);
    expect(await db.service.count({ where: { id: hotelService.id } })).toBe(1);
    auth.actor.roles = [RoleCode.CONTABILIDAD];
    expect((await validatePOST(body({ action: "VALIDAR", version: 1 }), { params: Promise.resolve({ id: paymentId }) })).status).toBe(422);
    expect((await db.customerPayment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("REPORTADO");
    const rc = `00${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}`;
    expect((await validatePOST(body({ action: "VALIDAR", receiptNumber: "RC-0123", version: 1 }), { params: Promise.resolve({ id: paymentId }) })).status).toBe(422);
    const validation = await validatePOST(body({ action: "VALIDAR", receiptNumber: `  ${rc}  `, version: 1 }), { params: Promise.resolve({ id: paymentId }) });
    expect(validation.status).toBe(200);
    const receipt = await db.receipt.findUniqueOrThrow({ where: { paymentId } });
    expect(receipt.number).toBe(rc);
    expect(Number(receipt.amount)).toBe(2_000_000);
    const updated = await saleGET(new Request("http://localhost:3000/api/sales/" + saleId), { params: Promise.resolve({ id: saleId }) });
    expect((await updated.json()).sale.payments[0].receipt.number).toBe(rc);
    const repeatedValidation = await validatePOST(body({ action: "VALIDAR", receiptNumber: rc, version: 1 }), { params: Promise.resolve({ id: paymentId }) });
    expect(repeatedValidation.status).toBe(409);
    auth.actor.roles = [RoleCode.ASESOR];
    const context = { params: Promise.resolve({ id: saleId }) };
    const [a, b] = await Promise.all([paymentPOST(body({ amount: 4_000_000, method: "EFECTIVO", requestId: crypto.randomUUID() }), context), paymentPOST(body({ amount: 4_000_000, method: "EFECTIVO", requestId: crypto.randomUUID() }), context)]);
    expect([a.status, b.status].sort()).toEqual([201, 422]);
    const committed = await db.customerPayment.findMany({ where: { saleId, status: { in: ["REPORTADO", "VALIDADO"] } } });
    expect(committed.reduce((sum, p) => sum + Number(p.amount), 0)).toBe(6_000_000);
    const other = committed.find((payment) => payment.id !== paymentId)!;
    auth.actor.roles = [RoleCode.CONTABILIDAD];
    const duplicateRC = await validatePOST(body({ action: "VALIDAR", receiptNumber: rc, version: 1 }), { params: Promise.resolve({ id: other.id }) });
    expect(duplicateRC.status).toBe(409);
    expect((await db.customerPayment.findUniqueOrThrow({ where: { id: other.id } })).status).toBe("REPORTADO");
    const anotherRC = `${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}`;
    const [once, twice] = await Promise.all([
      validatePOST(body({ action: "VALIDAR", receiptNumber: anotherRC, version: 1 }), { params: Promise.resolve({ id: other.id }) }),
      validatePOST(body({ action: "VALIDAR", receiptNumber: anotherRC, version: 1 }), { params: Promise.resolve({ id: other.id }) }),
    ]);
    expect([once.status, twice.status].sort()).toEqual([200, 409]);
    expect(await db.receipt.count({ where: { paymentId: other.id } })).toBe(1);
    auth.actor.roles = [RoleCode.ASESOR];
    await expect(db.customerPayment.create({ data: { saleId, amount: 100, currency: "USD", method: "EFECTIVO", paidAt: new Date(), reportedById: userId } })).rejects.toThrow();
    expect(await db.customerPayment.count({ where: { saleId } })).toBe(2);
    const registered = await registerPOST(new Request("http://localhost:3000/api/sales/" + saleId + "/register", { method: "POST", headers: { origin: "http://localhost:3000" } }), context);
    expect(registered.status).toBe(200);
    expect(await db.task.count({ where: { saleId, type: "INICIAR_GESTION" } })).toBe(1);
    expect(await db.auditLog.count({ where: { entity: "Sale", entityId: saleId } })).toBeGreaterThanOrEqual(3);
  });

  it("contabilidad corrige OS y valor del abono junto a su recibo, conservando historial", async () => {
    auth.actor.roles = [RoleCode.CONTABILIDAD];
    const pay = await db.customerPayment.findFirstOrThrow({ where: { saleId }, orderBy: { createdAt: "asc" }, include: { receipt: true } });
    expect(pay.status).toBe("VALIDADO");
    const originalReceipt = pay.receipt?.number;
    const correction = (value: unknown) => correctAmountPATCH(new Request(`http://localhost:3000/api/payments/${pay.id}/amount`, { method: "PATCH", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(value) }), { params: Promise.resolve({ id: pay.id }) });
    expect((await correction({ amount: 3_000_000, version: pay.version, reason: "Ajuste en recibo" })).status).toBe(200);
    const changed = await db.customerPayment.findUniqueOrThrow({ where: { id: pay.id }, include: { receipt: true, corrections: true } });
    expect(Number(changed.amount)).toBe(3_000_000);
    expect(Number(changed.receipt?.amount)).toBe(3_000_000);
    expect(changed.receipt?.number).toBe(originalReceipt);
    expect(changed.corrections).toMatchObject([{ previousAmount: expect.anything(), newAmount: expect.anything(), reason: "Ajuste en recibo", status: "VALIDADO" }]);
    expect((await correction({ amount: 4_000_000, version: pay.version, reason: "Versión obsoleta" })).status).toBe(409);
    expect((await correction({ amount: 7_000_000, version: pay.version + 1, reason: "Excede el saldo" })).status).toBe(422);
    const reread = await saleGET(new Request(`http://localhost:3000/api/sales/${saleId}`), { params: Promise.resolve({ id: saleId }) });
    expect((await reread.json()).balance).toBe(1_000_000);

    const otherPayment = await db.customerPayment.findFirstOrThrow({ where: { saleId, id: { not: pay.id } }, include: { receipt: true } });
    const competing = (id: string, version: number, amount: number) => correctAmountPATCH(new Request(`http://localhost:3000/api/payments/${id}/amount`, { method: "PATCH", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ amount, version, reason: "Conciliación simultánea" }) }), { params: Promise.resolve({ id }) });
    const [firstCorrection, secondCorrection] = await Promise.all([
      competing(pay.id, changed.version, 4_000_000), competing(otherPayment.id, otherPayment.version, 5_000_000),
    ]);
    expect([firstCorrection.status, secondCorrection.status].filter((status) => status === 200)).toHaveLength(1);
    expect([409, 422]).toContain([firstCorrection.status, secondCorrection.status].find((status) => status !== 200));
    const reconciled = await db.customerPayment.findMany({ where: { saleId }, include: { receipt: true } });
    expect(reconciled.reduce((sum, payment) => sum + Number(payment.amount), 0)).toBe(8_000_000);
    for (const payment of reconciled) expect(Number(payment.receipt?.amount)).toBe(Number(payment.amount));

    const sale = await db.sale.findUniqueOrThrow({ where: { id: saleId } });
    let candidate = 9000;
    while (await db.sale.findUnique({ where: { number: String(candidate).padStart(4, "0") } })) candidate--;
    const replacement = String(candidate).padStart(4, "0");
    const orderRequest = (number: string, version: number) => editOrderPATCH(new Request(`http://localhost:3000/api/sales/${saleId}/os`, { method: "PATCH", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ orderNumber: number, version, reason: "Número mal digitado" }) }), { params: Promise.resolve({ id: saleId }) });
    expect((await orderRequest(replacement, sale.version)).status).toBe(200);
    expect((await orderRequest("999", sale.version + 1)).status).toBe(422);
    expect((await orderRequest(replacement, sale.version)).status).toBe(409);
    expect(await db.auditLog.count({ where: { entity: "Sale", entityId: saleId, action: "CORREGIR_OS" } })).toBe(1);
    auth.actor.roles = [RoleCode.ASESOR];
    const reused = await salePOST(body({ customerId, orderNumber, destination: "Cartagena", services: ["HOTEL"], startsAt: "", endsAt: "", total: 1_000_000, initialPayment: 0, requestId: crypto.randomUUID() }));
    expect(reused.status).toBe(201);
    extraSaleIds.push((await reused.json()).id);
    const blocked = await salePOST(body({ customerId, orderNumber, destination: "Bogotá", services: ["VUELO"], startsAt: "", endsAt: "", total: 1_000_000, initialPayment: 0, requestId: crypto.randomUUID() }));
    expect(blocked.status).toBe(409);

    const secondSaleId = extraSaleIds.at(-1)!;
    const reported = await paymentPOST(body({ amount: 200_000, method: "TRANSFERENCIA", requestId: crypto.randomUUID() }), { params: Promise.resolve({ id: secondSaleId }) });
    expect(reported.status).toBe(201);
    const reportedId = (await reported.json()).id;
    const denied = await correctAmountPATCH(new Request(`http://localhost:3000/api/payments/${reportedId}/amount`, { method: "PATCH", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ amount: 250_000, version: 1, reason: "Intento no permitido" }) }), { params: Promise.resolve({ id: reportedId }) });
    expect(denied.status).toBe(403);
    auth.actor.roles = [RoleCode.CONTABILIDAD];
    const editReported = await correctAmountPATCH(new Request(`http://localhost:3000/api/payments/${reportedId}/amount`, { method: "PATCH", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ amount: 250_000, version: 1, reason: "Abono reportado incorrecto" }) }), { params: Promise.resolve({ id: reportedId }) });
    expect(editReported.status).toBe(200);
    const correctedReported = await db.customerPayment.findUniqueOrThrow({ where: { id: reportedId } });
    expect(correctedReported.status).toBe("REPORTADO");
    expect(Number(correctedReported.amount)).toBe(250_000);
    expect(await db.receipt.findUnique({ where: { paymentId: reportedId } })).toBeNull();
    const pendingTask = await db.task.findUniqueOrThrow({ where: { paymentId: reportedId } });
    expect(pendingTask.description).toContain("250.000");
    const staleConfirmation = await validatePOST(body({ action: "VALIDAR", receiptNumber: `${Math.floor(Math.random() * 100000000).toString().padStart(8, "0")}`, version: 1 }), { params: Promise.resolve({ id: reportedId }) });
    expect(staleConfirmation.status).toBe(409);
    expect((await db.customerPayment.findUniqueOrThrow({ where: { id: reportedId } })).status).toBe("REPORTADO");
  });

  it("permite a administración modificar sus roles y los ajenos, sin perder al último administrador", async () => {
    for (const code of Object.values(RoleCode)) await db.role.upsert({ where: { code }, create: { code }, update: {} });
    const administrator = await db.role.findUniqueOrThrow({ where: { code: RoleCode.ADMINISTRADOR } });
    await db.userRole.create({ data: { userId, roleId: administrator.id } });
    auth.actor.roles = [RoleCode.ADMINISTRADOR];
    const ownContext = { params: Promise.resolve({ id: userId }) };
    const edit = (targetId: string, value: unknown) => editRolesPATCH(new Request(`http://localhost:3000/api/users/${targetId}/roles`, { method: "PATCH", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(value) }), { params: Promise.resolve({ id: targetId }) });

    const own = await edit(userId, { roles: ["ADMINISTRADOR", "ASESOR"], version: 1, reason: "Atención comercial" });
    expect(own.status).toBe(200);
    expect((await db.user.findUniqueOrThrow({ where: { id: userId } })).version).toBe(2);
    const audit = await db.auditLog.findFirstOrThrow({ where: { actorId: userId, entity: "User", entityId: userId, action: "MODIFICAR_ROLES" } });
    expect(audit.reason).toBe("Atención comercial");
    expect(audit.after).toMatchObject({ roles: ["ADMINISTRADOR", "ASESOR"] });
    expect((await edit(userId, { roles: ["ADMINISTRADOR", "CONTABILIDAD"], version: 1, reason: "Versión anterior" })).status).toBe(409);
    expect((await edit(userId, { roles: ["ASESOR"], version: 2, reason: "Cambio de rol" })).status).toBe(409);

    const colleague = await db.user.create({ data: { name: "Otro usuario", email: `otro-${crypto.randomUUID()}@example.test`, passwordHash: "test-only" } });
    extraUserIds.push(colleague.id);
    expect((await edit(colleague.id, { roles: ["BACK_OFFICE"], version: 1, reason: "Responsable operativo" })).status).toBe(200);
    expect(await db.userRole.count({ where: { userId: colleague.id, role: { code: RoleCode.BACK_OFFICE } } })).toBe(1);

    const secondAdmin = await db.user.create({ data: { name: "Segunda persona", email: `segundo-${crypto.randomUUID()}@example.test`, passwordHash: "test-only", roles: { create: { roleId: administrator.id } } } });
    extraUserIds.push(secondAdmin.id);
    const release = await edit(userId, { roles: ["ASESOR"], version: 2, reason: "Delegación de administración" });
    expect(release.status).toBe(200);
    expect(await db.userRole.count({ where: { userId, role: { code: RoleCode.ADMINISTRADOR } } })).toBe(0);
    expect((await edit(colleague.id, { roles: ["ASESOR"], version: 2, reason: "Intento sin autorización" })).status).toBe(403);
  });
});
