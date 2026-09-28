import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PrismaClient, RoleCode } from "@prisma/client";

const auth = vi.hoisted(() => ({ actor: { id: "", email: "", name: "Soporte", roles: ["ADMINISTRADOR"] as string[] } }));
vi.mock("@/lib/auth", () => ({
  currentUser: async () => auth.actor,
  sameOrigin: () => true,
  hasRole: (actor: { roles: string[] }, ...roles: string[]) => actor.roles.includes("ADMINISTRADOR") || roles.some((role) => actor.roles.includes(role)),
  isAdministrator: (actor: { roles: string[] }) => actor.roles.includes("ADMINISTRADOR"),
}));

const url = process.env.TEST_DATABASE_URL;
if (!url || !/(^|[_-])test($|[_-])/i.test(new URL(url).pathname.slice(1)) ||
  (process.env.DATABASE_URL && new URL(url).host === new URL(process.env.DATABASE_URL).host && new URL(url).pathname === new URL(process.env.DATABASE_URL).pathname)) throw new Error("Usa la base PostgreSQL de pruebas, no la base principal.");
process.env.DATABASE_URL = url;
const db = new PrismaClient({ datasources: { db: { url } } });

let saleRoute: typeof import("@/app/api/sales/[id]/delete/route");
let paymentRoute: typeof import("@/app/api/payments/[id]/delete/route");
let customerRoute: typeof import("@/app/api/customers/[id]/delete/route");
let receiptRoute: typeof import("@/app/api/receipts/[id]/delete/route");
let salesGET: typeof import("@/app/api/sales/[id]/route").GET;
let adminId = "", advisorId = "", customerId = "", saleId = "", supplierId = "", os = "", rc = "";

const request = (resource: string, input?: object) => new Request(`http://localhost:3000/api/${resource}`, input ? {
  method: "POST", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(input),
} : undefined);
const context = (id: string) => ({ params: Promise.resolve({ id }) });

beforeAll(async () => {
  for (const code of Object.values(RoleCode)) await db.role.upsert({ where: { code }, create: { code }, update: {} });
  const admin = await db.user.create({ data: { email: `super-${crypto.randomUUID()}@example.test`, name: "Soporte", passwordHash: "test-only", roles: { create: { role: { connect: { code: RoleCode.ADMINISTRADOR } } } } } });
  adminId = admin.id; auth.actor.id = adminId; auth.actor.email = admin.email;
  const advisor = await db.user.create({ data: { email: `asesor-${crypto.randomUUID()}@example.test`, name: "Asesor de prueba", passwordHash: "test-only", roles: { create: { role: { connect: { code: RoleCode.ASESOR } } } } } });
  advisorId = advisor.id;
  const customer = await db.customer.create({ data: { code: `CLI-${crypto.randomUUID().slice(0, 10)}`, firstName: "Prueba", lastName: "Superusuario", phone: "3009999999", createdById: advisorId } });
  customerId = customer.id;
  await db.auditLog.create({ data: { actorId: adminId, entity: "Customer", entityId: customerId, action: "CREAR" } });
  let i = 9980;
  while (await db.sale.findUnique({ where: { number: String(i).padStart(4, "0") } })) i--;
  os = String(i).padStart(4, "0");
  rc = `00${Math.floor(Math.random() * 100_000_000).toString().padStart(8, "0")}`;
  const sale = await db.sale.create({ data: { number: os, customerId, advisorId, destination: "Cartagena", serviceType: "HOTEL", total: 8_000_000, currency: "COP" } });
  saleId = sale.id;
  const payment = await db.customerPayment.create({ data: { saleId, amount: 2_000_000, paidAt: new Date(), method: "TRANSFERENCIA", status: "VALIDADO", reportedById: advisorId } });
  const receipt = await db.receipt.create({ data: { paymentId: payment.id, saleId, amount: 2_000_000, number: rc } });
  await db.customerPaymentValidation.create({ data: { paymentId: payment.id, actorId: adminId, action: "VALIDAR" } });
  await db.paymentAmountCorrection.create({ data: { paymentId: payment.id, actorId: adminId, receiptId: receipt.id, previousAmount: 1_500_000, newAmount: 2_000_000, status: "VALIDADO", reason: "Prueba" } });
  await db.task.create({ data: { paymentId: payment.id, saleId, type: "VALIDAR_PAGO", description: "Prueba", assignedRole: RoleCode.CONTABILIDAD } });
  await db.auditLog.createMany({ data: [
    { actorId: adminId, entity: "Sale", entityId: saleId, action: "CREAR" },
    { actorId: adminId, entity: "CustomerPayment", entityId: payment.id, action: "VALIDAR" },
    { actorId: adminId, entity: "Receipt", entityId: receipt.id, action: "CREAR" },
  ] });
  await db.idempotencyKey.createMany({ data: [
    { key: crypto.randomUUID(), actorId: adminId, operation: "SALE_CREATE", entityId: saleId },
    { key: crypto.randomUUID(), actorId: adminId, operation: "PAYMENT_REPORT", entityId: payment.id },
  ] });
  const supplier = await db.supplier.create({ data: { name: "Proveedor independiente" } });
  supplierId = supplier.id;
  const service = await db.service.create({ data: { saleId, supplierId, type: "HOTEL", name: "Hotel", currency: "COP" } });
  await db.reservation.create({ data: { serviceId: service.id, locator: "A123" } });
  const payable = await db.supplierPayable.create({ data: { supplierId, serviceId: service.id, amount: 200_000, dueAt: new Date("2026-12-15T00:00:00Z") } });
  const supplierPayment = await db.supplierPayment.create({ data: { payableId: payable.id, amount: 200_000, paidAt: new Date() } });
  await db.accountingExpense.create({ data: { supplierPaymentId: supplierPayment.id, number: `EG-${crypto.randomUUID().slice(0, 10)}` } });
  await db.document.create({ data: { saleId, type: "OTRO", objectKey: crypto.randomUUID(), filename: "prueba.txt", mimeType: "text/plain", uploadedById: adminId } });
  await db.alert.create({ data: { key: crypto.randomUUID(), saleId, type: "PRUEBA", message: "Prueba" } });
  const passenger = await db.passenger.create({ data: { firstName: "Pasajera", lastName: "Única" } });
  await db.salePassenger.create({ data: { saleId, passengerId: passenger.id } });
  await db.comment.create({ data: { saleId, authorId: adminId, content: "Prueba" } });

  saleRoute = await import("@/app/api/sales/[id]/delete/route");
  paymentRoute = await import("@/app/api/payments/[id]/delete/route");
  customerRoute = await import("@/app/api/customers/[id]/delete/route");
  receiptRoute = await import("@/app/api/receipts/[id]/delete/route");
  ({ GET: salesGET } = await import("@/app/api/sales/[id]/route"));
});

afterAll(async () => {
  if (customerId && await db.customer.findUnique({ where: { id: customerId } })) {
    const { deleteCustomerGraph } = await import("@/lib/hard-delete");
    await db.$transaction((tx) => deleteCustomerGraph(tx, customerId), { timeout: 30_000 });
  }
  if (supplierId) await db.supplier.delete({ where: { id: supplierId } });
  if (adminId) {
    await db.auditLog.deleteMany({ where: { actorId: { in: [adminId, advisorId] } } });
    await db.userRole.deleteMany({ where: { userId: { in: [adminId, advisorId] } } });
    await db.user.deleteMany({ where: { id: { in: [adminId, advisorId] } } });
  }
  await db.$disconnect();
});

it("admin puede ver cualquier expediente, pero otro rol no puede iniciar borrado", async () => {
  expect((await salesGET(request(`sales/${saleId}`), context(saleId))).status).toBe(200);
  const { PATCH: editDraft } = await import("@/app/api/sales/[id]/route");
  const edit = await editDraft(new Request(`http://localhost:3000/api/sales/${saleId}`, { method: "PATCH", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ version: 1, destination: "Cartagena", startsAt: "2026-11-15", endsAt: "2026-11-20", customerDueAt: "", total: 8_000_000 }) }), context(saleId));
  expect(edit.status).toBe(200);
  const { POST: register } = await import("@/app/api/sales/[id]/register/route");
  const registered = await register(request(`sales/${saleId}/register`, {}), context(saleId));
  expect(registered.status, JSON.stringify(await registered.clone().json())).toBe(200);
  await db.invoice.create({ data: { saleId, number: `FAC-${crypto.randomUUID().slice(0, 10)}`, amount: 8_000_000, issuedAt: new Date(), snapshot: { orderNumber: os } } });

  const reported = await db.customerPayment.create({ data: { saleId, amount: 50_000, paidAt: new Date(), method: "TRANSFERENCIA", reportedById: advisorId } });
  const { POST: validate } = await import("@/app/api/payments/[id]/validate/route");
  const { PATCH: correct } = await import("@/app/api/payments/[id]/amount/route");
  const otherNumber = `7${Math.floor(Math.random() * 100_000_000).toString().padStart(8, "0")}`;
  expect((await validate(request(`payments/${reported.id}/validate`, { action: "VALIDAR", receiptNumber: otherNumber, version: 1 }), context(reported.id))).status).toBe(200);
  expect((await correct(new Request(`http://localhost:3000/api/payments/${reported.id}/amount`, { method: "PATCH", headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify({ amount: 75_000, version: 2, reason: "Soporte contable" }) }), context(reported.id))).status).toBe(200);
  const tempPreview = await (await paymentRoute.GET(request(`payments/${reported.id}/delete`), context(reported.id))).json();
  expect((await paymentRoute.POST(request(`payments/${reported.id}/delete`, { confirm: otherNumber, fingerprint: tempPreview.fingerprint }), context(reported.id))).status).toBe(200);

  const advisor = auth.actor;
  auth.actor = { ...advisor, roles: [RoleCode.ASESOR] };
  expect((await saleRoute.GET(request(`sales/${saleId}/delete`), context(saleId))).status).toBe(403);
  expect((await paymentRoute.POST(request(`payments/${(await db.customerPayment.findFirstOrThrow({ where: { saleId } })).id}/delete`, { confirm: rc, fingerprint: "x" }), context((await db.customerPayment.findFirstOrThrow({ where: { saleId } })).id))).status).toBe(403);
  auth.actor = advisor;
});

it("elimina pago validado y recibo en conjunto sin borrar la venta ni dejar auditoría relacionada", async () => {
  const payment = await db.customerPayment.findFirstOrThrow({ where: { saleId }, include: { receipt: true } });
  const endpoint = `payments/${payment.id}/delete`;
  const preview = await (await paymentRoute.GET(request(endpoint), context(payment.id))).json();
  expect(preview.details).toMatchObject({ abonos: 1, recibos: 1, correcciones: 1, validaciones: 1 });
  expect((await paymentRoute.POST(request(endpoint, { confirm: "incorrecto", fingerprint: preview.fingerprint }), context(payment.id))).status).toBe(422);
  expect(await db.customerPayment.count({ where: { id: payment.id } })).toBe(1);
  expect((await paymentRoute.POST(request(endpoint, { confirm: rc, fingerprint: preview.fingerprint }), context(payment.id))).status).toBe(200);
  expect(await db.customerPayment.count({ where: { id: payment.id } })).toBe(0);
  expect(await db.receipt.count({ where: { id: payment.receipt!.id } })).toBe(0);
  expect(await db.customerPaymentValidation.count({ where: { paymentId: payment.id } })).toBe(0);
  expect(await db.paymentAmountCorrection.count({ where: { paymentId: payment.id } })).toBe(0);
  expect(await db.auditLog.count({ where: { entityId: { in: [payment.id, payment.receipt!.id] } } })).toBe(0);
  const sale = await salesGET(request(`sales/${saleId}`), context(saleId));
  expect((await sale.json()).balance).toBe(8_000_000);
  const again = await db.customerPayment.create({ data: { saleId, amount: 500_000, paidAt: new Date(), method: "EFECTIVO", reportedById: adminId, status: "VALIDADO" } });
  await db.receipt.create({ data: { saleId, paymentId: again.id, number: rc, amount: again.amount } });
});

it("elimina recibos sueltos, y la OS completa con facturas, proveedores, documentos y auditorías", async () => {
  const orphan = await db.receipt.create({ data: { saleId, number: `9${Math.floor(Math.random() * 100_000_000)}`, amount: 1 } });
  await db.auditLog.create({ data: { actorId: adminId, entity: "Receipt", entityId: orphan.id, action: "CREAR" } });
  const receiptUrl = `receipts/${orphan.id}/delete`;
  const orphanPreview = await (await receiptRoute.GET(request(receiptUrl), context(orphan.id))).json();
  expect((await receiptRoute.POST(request(receiptUrl, { confirm: orphan.number, fingerprint: orphanPreview.fingerprint }), context(orphan.id))).status).toBe(200);
  expect(await db.auditLog.count({ where: { entityId: orphan.id } })).toBe(0);
  const endpoint = `sales/${saleId}/delete`;
  const preview = await (await saleRoute.GET(request(endpoint), context(saleId))).json();
  expect(preview.details).toMatchObject({ ventas: 1, recibos: 1, documentos: 1, servicios: 1, reservas: 1, obligaciones: 1, egresos: 1, facturas: 1, pasajeros: 1 });
  const task = await db.task.create({ data: { saleId, type: "PRUEBA", description: "Modificación entre confirmación y borrado" } });
  expect((await saleRoute.POST(request(endpoint, { confirm: os, fingerprint: preview.fingerprint }), context(saleId))).status).toBe(409);
  const latest = await (await saleRoute.GET(request(endpoint), context(saleId))).json();
  expect(latest.details.tareas).toBe(2);
  expect((await saleRoute.POST(request(endpoint, { confirm: os, fingerprint: latest.fingerprint }), context(saleId))).status).toBe(200);
  expect(await db.sale.findUnique({ where: { id: saleId } })).toBeNull();
  expect(await db.auditLog.count({ where: { entityId: { in: [saleId, task.id] } } })).toBe(0);
  expect(await db.supplier.findUnique({ where: { id: supplierId } })).not.toBeNull();
  const second = await db.sale.create({ data: { number: os, customerId, advisorId, destination: "OS reutilizada", serviceType: "HOTEL", total: 100_000 } });
  saleId = second.id;
  await db.customerPayment.create({ data: { saleId, amount: 100_000, paidAt: new Date(), method: "TRANSFERENCIA", reportedById: adminId, status: "VALIDADO", receipt: { create: { saleId, number: rc, amount: 100_000 } } } });
  await db.auditLog.create({ data: { actorId: adminId, entity: "Sale", entityId: saleId, action: "CREAR" } });
});

it("elimina definitivamente un cliente con OS y recibo validado, incluidas las auditorías relacionadas", async () => {
  const endpoint = `customers/${customerId}/delete`;
  const customer = await db.customer.findUniqueOrThrow({ where: { id: customerId } });
  const change = await db.customerChange.create({ data: { customerId, actorId: adminId, field: "phone", oldValue: "3009999999", newValue: "3159999999" } });
  await db.auditLog.create({ data: { actorId: adminId, entity: "CustomerChange", entityId: change.id, action: "EDITAR" } });
  const before = await (await customerRoute.GET(request(endpoint), context(customerId))).json();
  expect(before.details).toMatchObject({ clientes: 1, cambios_de_cliente: 1, ventas: 1, abonos: 1, recibos: 1 });
  expect((await customerRoute.POST(request(endpoint, { confirm: customer.code, fingerprint: before.fingerprint }), context(customerId))).status).toBe(200);
  expect(await db.customer.findUnique({ where: { id: customerId } })).toBeNull();
  expect(await db.sale.findUnique({ where: { id: saleId } })).toBeNull();
  expect(await db.receipt.count({ where: { number: rc } })).toBe(0);
  expect(await db.customerChange.count({ where: { customerId } })).toBe(0);
  expect(await db.auditLog.count({ where: { entityId: { in: [saleId, customerId, change.id] } } })).toBe(0);
  expect(await db.auditLog.count({ where: { action: "ELIMINAR" } })).toBe(0);
});
