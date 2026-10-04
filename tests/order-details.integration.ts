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

let detailRoute: typeof import("@/app/api/sales/[id]/order-details/route");
let supplierRoute: typeof import("@/app/api/suppliers/route");
let issuesRoute: typeof import("@/app/api/sales/[id]/order-issues/route");
let pdfRoute: typeof import("@/app/api/sales/[id]/order-issues/[issueId]/route");
let deleteRoute: typeof import("@/app/api/sales/[id]/delete/route");
let saleId = "", otherSaleId = "", customerId = "", flightId = "", hotelId = "", supplierId = "", issueId = "";
const users: { id: string; role: RoleCode }[] = [];
const params = () => ({ params: Promise.resolve({ id: saleId }) });
const issueParams = () => ({ params: Promise.resolve({ id: saleId, issueId }) });
const request = (path: string, body?: object, method = "GET") => new Request(`http://localhost:3000${path}`, body ? { method, headers: { origin: "http://localhost:3000", "content-type": "application/json" }, body: JSON.stringify(body) } : undefined);
const orderRequest = (data: object) => request(`/api/sales/${saleId}/order-details`, data, "PATCH");
function become(role: RoleCode, other = false) {
  const user = users.filter((item) => item.role === role)[other ? 1 : 0];
  auth.actor = { id: user.id, name: role, email: `${role}@example.test`, roles: [role] };
}
async function update(section: string, fields: object, version?: number) {
  return detailRoute.PATCH(orderRequest({ section, version: version ?? (await db.sale.findUniqueOrThrow({ where: { id: saleId } })).version, ...fields }), params());
}

beforeAll(async () => {
  for (const role of [RoleCode.ASESOR, RoleCode.ASESOR, RoleCode.BACK_OFFICE, RoleCode.CONTABILIDAD, RoleCode.ADMINISTRADOR]) {
    const user = await db.user.create({ data: { email: `os-detail-${crypto.randomUUID()}@example.test`, name: role, passwordHash: "test-only" } });
    users.push({ id: user.id, role });
  }
  become(RoleCode.ASESOR);
  const customer = await db.customer.create({ data: { code: `OSD-${crypto.randomUUID().slice(0, 12)}`, firstName: "Luz", lastName: "López", phone: "3001234567", createdById: auth.actor.id } });
  customerId = customer.id;
  let number = 8300;
  while (await db.sale.findFirst({ where: { number: { in: [String(number), String(number - 1)] } } })) number -= 2;
  saleId = (await db.sale.create({ data: { number: String(number), customerId, advisorId: auth.actor.id, destination: "Lima", total: 1_000_000,
    startsAt: new Date("2027-03-01T00:00:00Z"), endsAt: new Date("2027-03-09T00:00:00Z"), customerDueAt: new Date("2027-02-10T00:00:00Z"),
    services: { create: [{ type: "VUELO", name: "Vuelos" }, { type: "HOTEL", name: "Hotel" }] } } })).id;
  otherSaleId = (await db.sale.create({ data: { number: String(number - 1), customerId, advisorId: auth.actor.id, destination: "Quito", total: 900_000,
    services: { create: [{ type: "HOTEL", name: "Hotel" }] } } })).id;
  flightId = (await db.service.findFirstOrThrow({ where: { saleId, type: "VUELO" } })).id;
  hotelId = (await db.service.findFirstOrThrow({ where: { saleId, type: "HOTEL" } })).id;
  detailRoute = await import("@/app/api/sales/[id]/order-details/route");
  supplierRoute = await import("@/app/api/suppliers/route");
  issuesRoute = await import("@/app/api/sales/[id]/order-issues/route");
  pdfRoute = await import("@/app/api/sales/[id]/order-issues/[issueId]/route");
  deleteRoute = await import("@/app/api/sales/[id]/delete/route");
});

afterAll(async () => {
  if (customerId && await db.customer.findUnique({ where: { id: customerId } })) {
    const { deleteCustomerGraph } = await import("@/lib/hard-delete");
    await db.$transaction((tx) => deleteCustomerGraph(tx, customerId), { timeout: 30_000 });
  }
  if (supplierId) {
    await db.auditLog.deleteMany({ where: { entity: "Supplier", entityId: supplierId } });
    await db.supplier.deleteMany({ where: { id: supplierId } });
  }
  await db.auditLog.deleteMany({ where: { actorId: { in: users.map(({ id }) => id) } } });
  await db.user.deleteMany({ where: { id: { in: users.map(({ id }) => id) } } });
  await db.$disconnect();
});

it("protege cada sección, guarda personas, pasajero, proveedor, tramos y desglose, y conserva el PDF emitido", async () => {
  become(RoleCode.ASESOR, true);
  expect((await detailRoute.GET(request(`/api/sales/${saleId}/order-details`), params())).status).toBe(403);
  expect((await update("people", { requestedAt: "", contactName: "Sin permiso", holderName: "", billingName: "", billingDocument: "", billingPhone: "", billingAddress: "", billingCity: "" })).status).toBe(403);
  become(RoleCode.BACK_OFFICE);
  expect((await update("prices", { lines: [] })).status).toBe(403);
  expect((await issuesRoute.POST(request(`/api/sales/${saleId}/order-issues`, { requestId: crypto.randomUUID() }, "POST"), params())).status).toBe(403);
  become(RoleCode.ASESOR);
  const people = { requestedAt: "2027-01-05", contactName: "María Acosta", holderName: "Luz López", billingName: "Empresa SAS", billingDocument: "900123456", billingPhone: "6011234567", billingAddress: "Calle 1", billingCity: "Bogotá" };
  expect((await update("people", people)).status).toBe(200);
  expect((await update("people", { ...people, requestedAt: "2027-02-31" })).status).toBe(422);
  const supplier = await supplierRoute.POST(request("/api/suppliers", { name: "Mayorista Uno" }, "POST"));
  expect(supplier.status).toBe(201);
  supplierId = (await supplier.json()).supplier.id;
  const flight = { supplierId, route: "BOG-LIM-BOG", planType: "Turista", baggage: "23 kg", transportCompany: "Aerolínea", hotelName: "",
    segments: [{ airline: "LA", departureDate: "2027-03-01", arrivalDate: "2027-03-02", origin: "BOG", destination: "LIM", departureTime: "23:15", arrivalTime: "02:30", cabinClass: "Economía" }] };
  expect((await update("service", { serviceId: hotelId, ...flight })).status).toBe(422);
  expect((await update("service", { serviceId: flightId, ...flight })).status).toBe(200);
  expect((await update("service", { serviceId: hotelId, supplierId, route: "", planType: "Desayuno", baggage: "", transportCompany: "", hotelName: "Hotel Mirador", segments: [] })).status).toBe(200);
  become(RoleCode.BACK_OFFICE);
  const passenger = { firstName: "Luz", lastName: "López", documentType: "CC", documentNumber: "1001234", birthDate: "1990-06-12", passportNumber: "PA1234", passportExpiry: "2030-06-12" };
  expect((await update("passengers", { passengers: [passenger] })).status).toBe(200);
  const identity = await db.salePassenger.findFirstOrThrow({ where: { saleId }, include: { passenger: true } });
  expect(identity.passenger.passportNumber).toBe("PA1234");
  const second = await detailRoute.PATCH(request(`/api/sales/${otherSaleId}/order-details`, { section: "passengers", version: 1, passengers: [passenger] }, "PATCH"), { params: Promise.resolve({ id: otherSaleId }) });
  expect(second.status).toBe(200);
  expect((await db.salePassenger.findFirstOrThrow({ where: { saleId: otherSaleId } })).passengerId).toBe(identity.passengerId);
  expect((await update("passengers", { passengers: [passenger, passenger] })).status).toBe(422);
  const operational = await (await detailRoute.GET(request(`/api/sales/${saleId}/order-details`), params())).json();
  expect(operational.sale.total).toBeUndefined();
  expect(operational.sale.priceLines).toBeUndefined();
  become(RoleCode.ASESOR);
  expect((await update("prices", { lines: [{ category: "ADULTO", quantity: 2, unitPrice: 400_000 }, { category: "NINO", quantity: 1, unitPrice: 100_000 }] })).status).toBe(200);
  const current = await db.sale.findUniqueOrThrow({ where: { id: saleId } });
  expect(Number(current.total)).toBe(1_000_000);
  const issueRequestId = crypto.randomUUID();
  const issued = await issuesRoute.POST(request(`/api/sales/${saleId}/order-issues`, { requestId: issueRequestId }, "POST"), params());
  expect(issued.status).toBe(201);
  issueId = (await issued.json()).id;
  const replay = await issuesRoute.POST(request(`/api/sales/${saleId}/order-issues`, { requestId: issueRequestId }, "POST"), params());
  expect(replay.status).toBe(200);
  expect((await replay.json()).id).toBe(issueId);
  const original = await db.saleOrderIssue.findUniqueOrThrow({ where: { id: issueId } });
  expect(original.snapshot).toMatchObject({ billingName: "Empresa SAS", validated: 0, balance: 1_000_000 });
  const pdf = await pdfRoute.GET(request(`/api/sales/${saleId}/order-issues/${issueId}`), issueParams());
  expect(pdf.status).toBe(200);
  expect(pdf.headers.get("content-type")).toBe("application/pdf");
  expect(Buffer.from(await pdf.arrayBuffer()).subarray(0, 5).toString()).toBe("%PDF-");
  expect((await update("people", { ...people, billingName: "Otra empresa" })).status).toBe(200);
  expect((await db.saleOrderIssue.findUniqueOrThrow({ where: { id: issueId } })).snapshot).toMatchObject({ billingName: "Empresa SAS" });
  expect(await db.flightSegment.count({ where: { serviceId: flightId } })).toBe(1);
  expect(await db.salePriceLine.count({ where: { saleId } })).toBe(2);
});

it("impide modificaciones obsoletas y elimina detalles, PDFs y auditorías al borrar la OS", async () => {
  become(RoleCode.ASESOR);
  const previous = (await db.sale.findUniqueOrThrow({ where: { id: saleId } })).version;
  const base = { requestedAt: "", contactName: "", holderName: "", billingName: "", billingDocument: "", billingPhone: "", billingAddress: "", billingCity: "" };
  expect((await update("people", base, previous)).status).toBe(200);
  expect((await update("people", base, previous)).status).toBe(409);
  become(RoleCode.ADMINISTRADOR);
  const url = `/api/sales/${saleId}/delete`;
  const impact = await (await deleteRoute.GET(request(url), params())).json();
  expect(impact.details.tramos_vuelo).toBe(1);
  expect(impact.details.precios_pasajeros).toBe(2);
  expect(impact.details.ordenes_emitidas).toBe(1);
  const number = (await db.sale.findUniqueOrThrow({ where: { id: saleId } })).number;
  expect((await deleteRoute.POST(request(url, { confirm: number, fingerprint: impact.fingerprint }, "POST"), params())).status).toBe(200);
  expect(await db.flightSegment.count({ where: { serviceId: flightId } })).toBe(0);
  expect(await db.salePriceLine.count({ where: { saleId } })).toBe(0);
  expect(await db.saleOrderIssue.count({ where: { saleId } })).toBe(0);
  expect(await db.auditLog.count({ where: { entityId: issueId } })).toBe(0);
  expect(await db.idempotencyKey.count({ where: { entityId: issueId } })).toBe(0);
  expect(await db.sale.findUnique({ where: { id: saleId } })).toBeNull();
  expect(await db.passenger.count({ where: { sales: { some: { saleId: otherSaleId } } } })).toBe(1);
  expect(await db.sale.findUnique({ where: { id: otherSaleId } })).not.toBeNull();
});
