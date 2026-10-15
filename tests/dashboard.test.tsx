import { beforeEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RoleCode } from "@prisma/client";

const mocks = vi.hoisted(() => ({
  actor: { id: "user-1", name: "Ana Viajes", email: "ana@example.com", roles: ["ASESOR"] as RoleCode[] },
  sales: { findMany: vi.fn(), count: vi.fn() }, payments: { findMany: vi.fn(), count: vi.fn() }, tasks: { findMany: vi.fn(), count: vi.fn() },
}));
vi.mock("@/lib/auth", () => ({
  currentUser: async () => mocks.actor,
  hasRole: (actor: { roles: RoleCode[] }, ...roles: RoleCode[]) => actor.roles.includes(RoleCode.ADMINISTRADOR) || roles.some((role) => actor.roles.includes(role)),
}));
vi.mock("@/lib/db", () => ({ db: { sale: mocks.sales, customerPayment: mocks.payments, task: mocks.tasks } }));
vi.mock("next/cache", () => ({ unstable_cache: (fn: (...args: unknown[]) => unknown) => fn }));

import HomePage from "@/app/(workspace)/page";
import SalesPage from "@/app/(workspace)/ventas/page";
import { dashboardAccess, dashboardPaymentScope, dashboardSaleScope, dashboardTaskScope } from "@/lib/dashboard-scope";

beforeEach(() => {
  vi.clearAllMocks(); mocks.actor.roles = [RoleCode.ASESOR];
  mocks.sales.findMany.mockResolvedValue([]); mocks.sales.count.mockResolvedValue(2);
  mocks.payments.findMany.mockResolvedValue([]); mocks.payments.count.mockResolvedValue(3);
  mocks.tasks.findMany.mockResolvedValue([]); mocks.tasks.count.mockResolvedValue(4);
});

it("el asesor ve sus borradores y abonos reportados, con tarjetas que abren sus filtros", async () => {
  const html = renderToStaticMarkup(await HomePage());
  expect(html).toContain('href="/ventas?filtro=borradores"');
  expect(html).toContain('href="/ventas?filtro=abonos"');
  expect(html).toContain('href="/ventas?filtro=tareas"');
  expect(html).toContain('href="/ventas?filtro=recientes"');
  expect(html).toContain("Mis abonos reportados");
  expect(html).not.toContain("Abonos por validar");
  expect(mocks.payments.count).toHaveBeenCalledWith({ where: dashboardPaymentScope(mocks.actor) });
  expect(dashboardSaleScope(mocks.actor)).toEqual({ advisorId: "user-1" });
});

it("back office solo ve sus gestiones y no consulta ni muestra importes", async () => {
  mocks.actor.roles = [RoleCode.BACK_OFFICE];
  const html = renderToStaticMarkup(await HomePage());
  expect(html).toContain("Gestiones pendientes");
  expect(html).not.toContain('href="/ventas?filtro=abonos"');
  expect(html).not.toContain('href="/ventas?filtro=borradores"');
  expect(mocks.payments.count).not.toHaveBeenCalled();
  expect(mocks.payments.findMany).not.toHaveBeenCalled();
  expect(mocks.sales.count).not.toHaveBeenCalled();
  expect(dashboardTaskScope(mocks.actor)).toMatchObject({ status: "PENDIENTE", OR: expect.arrayContaining([{ assignedRole: RoleCode.BACK_OFFICE }]) });
});

it("una persona con gerencia y contabilidad combina ámbitos y puede validar", async () => {
  mocks.actor.roles = [RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.ASESOR];
  const html = renderToStaticMarkup(await HomePage());
  expect(html).toContain("Panorama del equipo");
  expect(html).toContain("Abonos por validar");
  expect(html).toContain("Borradores del equipo");
  expect(html).toContain("Tareas pendientes");
  expect(dashboardPaymentScope(mocks.actor)).toEqual({ status: "REPORTADO", sale: { is: {} } });
  expect(dashboardTaskScope(mocks.actor)).toEqual({ status: "PENDIENTE" });
});

it("los filtros de ventas usan los mismos ámbitos y muestran cada pendiente con acceso al expediente", async () => {
  mocks.payments.findMany.mockResolvedValueOnce([{ id: "pay-1", saleId: "sale-1", amount: "200000", paidAt: "2026-10-01", method: "EFECTIVO", sale: { number: "0123", destination: "Lima", customer: { firstName: "Ana", lastName: "Viajes" } } }]);
  const html = renderToStaticMarkup(await SalesPage({ searchParams: Promise.resolve({ filtro: "abonos" }) }));
  expect(html).toContain('href="/ventas/sale-1#abono-pay-1"');
  expect(html).toContain("Mis abonos reportados");
  expect(mocks.payments.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { AND: [dashboardPaymentScope(mocks.actor), { sale: { is: { AND: [dashboardSaleScope(mocks.actor), {}] } } }] } }));
  mocks.actor.roles = [RoleCode.BACK_OFFICE];
  const backOffice = renderToStaticMarkup(await SalesPage({ searchParams: Promise.resolve({ filtro: "abonos" }) }));
  expect(backOffice).not.toContain("Abonos reportados");
  expect(mocks.payments.findMany).toHaveBeenCalledTimes(1);
  expect(dashboardAccess(mocks.actor).canViewFinancial).toBe(false);
});

it("back office ve las tareas accesibles, con paginación cuando hay más de 50", async () => {
  mocks.actor.roles = [RoleCode.BACK_OFFICE];
  mocks.tasks.count.mockResolvedValue(61);
  mocks.tasks.findMany.mockResolvedValueOnce([{ id: "task-1", saleId: "sale-1", description: "Iniciar gestión de reservas", sale: { number: "0123", destination: "Lima", customer: { firstName: "Ana", lastName: "Viajes" } } }]);
  const html = renderToStaticMarkup(await SalesPage({ searchParams: Promise.resolve({ filtro: "tareas", pagina: "2" }) }));
  expect(html).toContain('href="/ventas/sale-1#tarea-task-1"');
  expect(html).toContain("página 2 de 2");
  expect(html).not.toContain("Siguiente →");
  expect(mocks.tasks.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 50, where: { AND: [dashboardTaskScope(mocks.actor), { sale: { is: { AND: [dashboardSaleScope(mocks.actor), {}] } } }] } }));
});
