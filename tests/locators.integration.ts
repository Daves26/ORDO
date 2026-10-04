import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { PrismaClient, RoleCode } from "@prisma/client";

const auth = vi.hoisted(() => ({ actor: { id: "", name: "Prueba", email: "", roles: ["ASESOR"] as string[] } }));
vi.mock("@/lib/auth", () => ({
  currentUser: async () => auth.actor,
  sameOrigin: () => true,
  hasRole: (actor: { roles: string[] }, ...roles: string[]) => actor.roles.includes("ADMINISTRADOR") || roles.some((role) => actor.roles.includes(role)),
  isAdministrator: (actor: { roles: string[] }) => actor.roles.includes("ADMINISTRADOR"),
}));

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !/(^|[_-])test($|[_-])/i.test(new URL(testUrl).pathname.slice(1)) ||
  (process.env.DATABASE_URL && new URL(testUrl).host === new URL(process.env.DATABASE_URL).host && new URL(testUrl).pathname === new URL(process.env.DATABASE_URL).pathname)) throw new Error("Usa exclusivamente la base PostgreSQL de pruebas.");
process.env.DATABASE_URL = testUrl;
const db = new PrismaClient({ datasources: { db: { url: testUrl } } });

let createRoute: typeof import("@/app/api/sales/[id]/locators/route");
let changeRoute: typeof import("@/app/api/sales/[id]/locators/[locatorId]/route");
let removeRoute: typeof import("@/app/api/sales/[id]/locators/[locatorId]/delete/route");
let deleteSaleRoute: typeof import("@/app/api/sales/[id]/delete/route");
let customerId = "", saleId = "", otherSaleId = "", flightId = "", otherServiceId = "", locatorId = "";
const users: { id: string; email: string; role: RoleCode }[] = [];
const params = (id: string) => ({ params: Promise.resolve({ id }) });
const locatorParams = (id: string, locatorId: string) => ({ params: Promise.resolve({ id, locatorId }) });
const request = (url: string, body?: object, method = "POST") => new Request(`http://localhost:3000${url}`, body ? {
  method, headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(body),
} : undefined);

function become(role: RoleCode) {
  const user = users.find((person) => person.role === role)!;
  auth.actor = { id: user.id, email: user.email, name: role, roles: [role] };
}

beforeAll(async () => {
  for (const role of [RoleCode.ASESOR, RoleCode.BACK_OFFICE, RoleCode.CONTABILIDAD, RoleCode.GERENTE, RoleCode.ADMINISTRADOR]) {
    const user = await db.user.create({ data: { email: `${role}-${crypto.randomUUID()}@example.test`, name: `Prueba ${role}`, passwordHash: "test-only" } });
    users.push({ id: user.id, email: user.email, role });
  }
  const second = await db.user.create({ data: { email: `asesor2-${crypto.randomUUID()}@example.test`, name: "Otro asesor", passwordHash: "test-only" } });
  users.push({ id: second.id, email: second.email, role: RoleCode.ASESOR });
  become(RoleCode.ASESOR);
  const customer = await db.customer.create({ data: { code: `LOC-${crypto.randomUUID().slice(0, 10)}`, firstName: "Laura", lastName: "Localizadores", phone: "3007777777", createdById: auth.actor.id } });
  customerId = customer.id;
  let code = 8700;
  while (await db.sale.findFirst({ where: { number: { in: [String(code).padStart(4, "0"), String(code + 1).padStart(4, "0")] } } })) code -= 2;
  const sale = await db.sale.create({ data: { number: String(code).padStart(4, "0"), customerId, advisorId: auth.actor.id, destination: "Lima", total: 1_000_000, services: { create: [{ type: "VUELO", name: "Vuelos" }, { type: "HOTEL", name: "Hotel" }] } } });
  saleId = sale.id;
  const other = await db.sale.create({ data: { number: String(code + 1).padStart(4, "0"), customerId, advisorId: second.id, destination: "Quito", total: 1_000_000, services: { create: { type: "HOTEL", name: "Hotel" } } } });
  otherSaleId = other.id;
  flightId = (await db.service.findFirstOrThrow({ where: { saleId, type: "VUELO" } })).id;
  otherServiceId = (await db.service.findFirstOrThrow({ where: { saleId: otherSaleId } })).id;
  createRoute = await import("@/app/api/sales/[id]/locators/route");
  changeRoute = await import("@/app/api/sales/[id]/locators/[locatorId]/route");
  removeRoute = await import("@/app/api/sales/[id]/locators/[locatorId]/delete/route");
  deleteSaleRoute = await import("@/app/api/sales/[id]/delete/route");
});

afterAll(async () => {
  if (customerId && await db.customer.findUnique({ where: { id: customerId } })) {
    const { deleteCustomerGraph } = await import("@/lib/hard-delete");
    await db.$transaction((tx) => deleteCustomerGraph(tx, customerId), { timeout: 30_000 });
  }
  await db.auditLog.deleteMany({ where: { actorId: { in: users.map((user) => user.id) } } });
  await db.user.deleteMany({ where: { id: { in: users.map((user) => user.id) } } });
  await db.$disconnect();
});

it("permite múltiples orígenes y emisor/servicio opcional, sin duplicar el mismo código del emisor", async () => {
  const input = { source: "MAYORISTA", issuerName: "Mayorista Norte", code: "0aB-123", serviceId: flightId, notes: "Emisión de voucher", requestId: crypto.randomUUID() };
  const first = await createRoute.POST(request(`/api/sales/${saleId}/locators`, input), params(saleId));
  expect(first.status).toBe(201);
  locatorId = (await first.json()).id;
  const replay = await createRoute.POST(request(`/api/sales/${saleId}/locators`, input), params(saleId));
  expect(replay.status).toBe(200);
  expect((await replay.json()).id).toBe(locatorId);
  const second = await createRoute.POST(request(`/api/sales/${saleId}/locators`, { ...input, source: "AEROLINEA", issuerName: "Avianca", requestId: crypto.randomUUID() }), params(saleId));
  expect(second.status).toBe(201);
  expect((await createRoute.POST(request(`/api/sales/${saleId}/locators`, { ...input, serviceId: null, requestId: crypto.randomUUID() }), params(saleId))).status).toBe(409);
  expect((await createRoute.POST(request(`/api/sales/${saleId}/locators`, { ...input, issuerName: "Otro emisor", requestId: crypto.randomUUID() }), params(saleId))).status).toBe(201);
  expect((await createRoute.POST(request(`/api/sales/${saleId}/locators`, { ...input, serviceId: otherServiceId, code: "OTRO-1", requestId: crypto.randomUUID() }), params(saleId))).status).toBe(422);
  expect((await createRoute.POST(request(`/api/sales/${saleId}/locators`, { ...input, source: "OTRO", issuerName: "", notes: "", requestId: crypto.randomUUID() }), params(saleId))).status).toBe(422);
  const listed = await createRoute.GET(request(`/api/sales/${saleId}/locators`), params(saleId));
  expect((await listed.json()).locators).toHaveLength(3);
  expect((await db.saleLocator.findUniqueOrThrow({ where: { id: locatorId } })).code).toBe("0aB-123");
});

it("asesor solo entra en propias; autor/back office/admin pueden corregir, contabilidad solo sus códigos", async () => {
  const update = (payload: unknown) => changeRoute.PATCH(request(`/api/sales/${saleId}/locators/${locatorId}`, payload as object, "PATCH"), locatorParams(saleId, locatorId));
  const otherAdvisor = users.filter(({ role }) => role === RoleCode.ASESOR)[1];
  auth.actor = { id: otherAdvisor.id, email: otherAdvisor.email, name: "Otro asesor", roles: [RoleCode.ASESOR] };
  expect((await createRoute.GET(request(`/api/sales/${saleId}/locators`), params(saleId))).status).toBe(403);
  expect((await createRoute.POST(request(`/api/sales/${saleId}/locators`, { source: "HOTEL", code: "H123", requestId: crypto.randomUUID() }), params(saleId))).status).toBe(403);
  expect((await update({ source: "MAYORISTA", issuerName: "Mayorista Norte", code: "0aB-124", notes: "", serviceId: flightId, version: 1 })).status).toBe(403);

  become(RoleCode.CONTABILIDAD);
  expect((await createRoute.GET(request(`/api/sales/${saleId}/locators`), params(saleId))).status).toBe(200);
  expect((await update({ source: "MAYORISTA", issuerName: "Mayorista Norte", code: "0aB-124", notes: "", serviceId: flightId, version: 1 })).status).toBe(403);
  expect((await createRoute.POST(request(`/api/sales/${saleId}/locators`, { source: "PROVEEDOR", code: "PR-501", requestId: crypto.randomUUID() }), params(saleId))).status).toBe(201);
  const own = await db.saleLocator.findFirstOrThrow({ where: { saleId, code: "PR-501" } });
  expect((await changeRoute.PATCH(request(`/api/sales/${saleId}/locators/${own.id}`, { source: "PROVEEDOR", code: "PR-502", version: 1 }, "PATCH"), locatorParams(saleId, own.id))).status).toBe(200);

  become(RoleCode.BACK_OFFICE);
  const changed = await update({ source: "MAYORISTA", issuerName: "Mayorista Norte", code: "0aB-124", notes: "Código corregido", serviceId: flightId, version: 1 });
  expect(changed.status).toBe(200);
  expect((await update({ source: "MAYORISTA", issuerName: "Mayorista Norte", code: "0aB-125", notes: "", serviceId: flightId, version: 1 })).status).toBe(409);
  const audit = await db.auditLog.findFirstOrThrow({ where: { entity: "SaleLocator", entityId: locatorId, action: "CORREGIR" } });
  expect(audit.before).toMatchObject({ code: "0aB-123" });
  expect(audit.after).toMatchObject({ code: "0aB-124" });
  expect(audit.actorId).toBe(auth.actor.id);

  become(RoleCode.ASESOR);
  expect((await update({ source: "MAYORISTA", issuerName: "Mayorista Norte", code: "0aB-126", notes: "Nueva corrección", serviceId: flightId, version: 2 })).status).toBe(200);
  become(RoleCode.ADMINISTRADOR);
  expect((await update({ source: "MAYORISTA", issuerName: "Mayorista Norte", code: "0aB-127", notes: "Soporte", serviceId: flightId, version: 3 })).status).toBe(200);
});

it("superusuario puede borrar un localizador; borrar la OS elimina códigos, claves y auditorías relacionadas", async () => {
  become(RoleCode.ADMINISTRADOR);
  const path = `/api/sales/${saleId}/locators/${locatorId}/delete`;
  const preview = await (await removeRoute.GET(request(path), locatorParams(saleId, locatorId))).json();
  expect(preview.details.localizadores).toBe(1);
  expect((await removeRoute.POST(request(path, { confirm: "incorrecto", fingerprint: preview.fingerprint }), locatorParams(saleId, locatorId))).status).toBe(422);
  expect((await removeRoute.POST(request(path, { confirm: "0aB-127", fingerprint: preview.fingerprint }), locatorParams(saleId, locatorId))).status).toBe(200);
  expect(await db.saleLocator.findUnique({ where: { id: locatorId } })).toBeNull();
  expect(await db.auditLog.count({ where: { entityId: locatorId } })).toBe(0);
  expect(await db.idempotencyKey.count({ where: { entityId: locatorId } })).toBe(0);
  const salePath = `/api/sales/${saleId}/delete`;
  const sale = await db.sale.findUniqueOrThrow({ where: { id: saleId } });
  const remainingIds = (await db.saleLocator.findMany({ where: { saleId }, select: { id: true } })).map(({ id }) => id);
  const impact = await (await deleteSaleRoute.GET(request(salePath), params(saleId))).json();
  expect(impact.details.localizadores).toBe(3);
  expect((await deleteSaleRoute.POST(request(salePath, { confirm: sale.number, fingerprint: impact.fingerprint }), params(saleId))).status).toBe(200);
  expect(await db.saleLocator.count({ where: { saleId } })).toBe(0);
  expect(await db.auditLog.count({ where: { entity: "SaleLocator", entityId: { in: remainingIds } } })).toBe(0);
  expect(await db.idempotencyKey.count({ where: { entityId: { in: remainingIds } } })).toBe(0);
  expect(await db.sale.findUnique({ where: { id: saleId } })).toBeNull();
  expect(await db.sale.findUnique({ where: { id: otherSaleId } })).not.toBeNull();
});
