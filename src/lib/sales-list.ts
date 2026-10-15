import { Prisma, RoleCode } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { dashboardAccess, dashboardPaymentScope, dashboardSaleScope, dashboardTaskScope } from "@/lib/dashboard-scope";
import { db } from "@/lib/db";
import { saleSearchNumber } from "@/lib/sale-number";
import type { Actor } from "@/lib/auth";

export type SalesFilter = "todas" | "recientes" | "borradores" | "abonos" | "tareas";
type SalesPageData = {
  total: number; page: number; updatedAt: string;
  sales: { id: string; number: string; destination: string; startsAt: string | null; total: string; commercialStatus: string; customer: { firstName: string; lastName: string } }[];
  payments: { id: string; saleId: string; amount: string; paidAt: string; method: string; sale: { number: string; destination: string; customer: { firstName: string; lastName: string } } }[];
  tasks: { id: string; saleId: string; description: string; sale: { number: string; destination: string; customer: { firstName: string; lastName: string } } }[];
};

export const getSalesPageData = unstable_cache(async (actorId: string, roles: RoleCode[], selected: SalesFilter, term: string, requestedPage: number): Promise<SalesPageData> => {
  const actor: Actor = { id: actorId, roles, name: "", email: "" };
  const access = dashboardAccess(actor);
  const words = term.split(/\s+/).filter(Boolean);
  const search: Prisma.SaleWhereInput = term ? { OR: [
    { number: { contains: saleSearchNumber(term), mode: "insensitive" } }, { destination: { contains: term, mode: "insensitive" } },
    { customer: { OR: [{ firstName: { contains: term, mode: "insensitive" } }, { lastName: { contains: term, mode: "insensitive" } }, { documentNumber: { contains: term } }, { phone: { contains: term } }, ...(words.length > 1 ? [{ AND: [{ firstName: { contains: words[0], mode: "insensitive" as const } }, { lastName: { contains: words.slice(1).join(" "), mode: "insensitive" as const } }] }] : [])] } },
  ] } : {};
  const saleWhere: Prisma.SaleWhereInput = { AND: [dashboardSaleScope(actor), search] };
  const taskWhere: Prisma.TaskWhereInput = { AND: [dashboardTaskScope(actor), { sale: { is: saleWhere } }] };
  const paymentWhere: Prisma.CustomerPaymentWhereInput = { AND: [dashboardPaymentScope(actor), { sale: { is: saleWhere } }] };
  const filteredSales: Prisma.SaleWhereInput = { ...saleWhere, ...(selected === "borradores" ? { commercialStatus: "BORRADOR" } : {}) };
  const page = selected === "recientes" ? 1 : Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 1000) : 1;
  const [total, sales, payments, tasks] = await Promise.all([
    selected === "abonos" ? db.customerPayment.count({ where: paymentWhere }) : selected === "tareas" ? db.task.count({ where: taskWhere }) : selected === "recientes" ? Promise.resolve(0) : db.sale.count({ where: filteredSales }),
    selected === "todas" || selected === "recientes" || selected === "borradores" ? db.sale.findMany({ where: filteredSales, select: {
      id: true, number: true, destination: true, startsAt: true, total: access.canViewFinancial, commercialStatus: true,
      customer: { select: { firstName: true, lastName: true } },
    }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: selected === "recientes" ? 8 : 50, skip: selected === "recientes" ? 0 : (page - 1) * 50 }) : Promise.resolve([]),
    selected === "abonos" ? db.customerPayment.findMany({ where: paymentWhere, select: {
      id: true, saleId: true, amount: true, paidAt: true, method: true,
      sale: { select: { number: true, destination: true, customer: { select: { firstName: true, lastName: true } } } },
    }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 50, skip: (page - 1) * 50 }) : Promise.resolve([]),
    selected === "tareas" ? db.task.findMany({ where: taskWhere, select: {
      id: true, saleId: true, description: true,
      sale: { select: { number: true, destination: true, customer: { select: { firstName: true, lastName: true } } } },
    }, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 50, skip: (page - 1) * 50 }) : Promise.resolve([]),
  ]);
  return JSON.parse(JSON.stringify({ total: selected === "recientes" ? sales.length : total, page, sales, payments, tasks, updatedAt: new Date().toISOString() })) as SalesPageData;
}, ["sales-list-v1"], { revalidate: 60, tags: ["sales-list"] });
