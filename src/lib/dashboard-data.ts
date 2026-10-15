import { RoleCode } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { dashboardAccess, dashboardPaymentScope, dashboardSaleScope, dashboardTaskScope } from "@/lib/dashboard-scope";
import { db } from "@/lib/db";
import type { Actor } from "@/lib/auth";

type DashboardData = {
  sales: { id: string; number: string; destination: string; total: string; startsAt: string | null; customer: { firstName: string; lastName: string } }[];
  draftCount: number; pendingPayments: number; taskCount: number;
  tasks: { id: string; saleId: string; description: string; sale: { number: string } }[];
  payments: { id: string; saleId: string; paidAt: string; amount: string; sale: { number: string; customer: { firstName: string; lastName: string } } }[];
  updatedAt: string;
};

// Only query-result data is cached. Session and permissions are read on every request;
// user ID and roles are both part of the cache key, so private results cannot cross accounts.
export const getDashboardData = unstable_cache(async (actorId: string, roles: RoleCode[]): Promise<DashboardData> => {
  const actor: Actor = { id: actorId, roles, name: "", email: "" };
  const access = dashboardAccess(actor);
  const scope = dashboardSaleScope(actor);
  const taskScope = dashboardTaskScope(actor);
  const paymentScope = dashboardPaymentScope(actor);
  const [sales, draftCount, pendingPayments, taskCount, tasks, payments] = await Promise.all([
    db.sale.findMany({ where: scope, orderBy: { createdAt: "desc" }, take: 8, select: {
      id: true, number: true, destination: true, total: access.canViewFinancial, startsAt: true,
      customer: { select: { firstName: true, lastName: true } },
    } }),
    access.canSell ? db.sale.count({ where: { ...scope, commercialStatus: "BORRADOR" } }) : Promise.resolve(0),
    access.canViewFinancial ? db.customerPayment.count({ where: paymentScope }) : Promise.resolve(0),
    db.task.count({ where: taskScope }),
    db.task.findMany({ where: taskScope, select: { id: true, saleId: true, description: true, sale: { select: { number: true } } }, orderBy: { createdAt: "asc" }, take: 5 }),
    access.canViewFinancial ? db.customerPayment.findMany({ where: paymentScope, select: {
      id: true, saleId: true, paidAt: true, amount: true,
      sale: { select: { number: true, customer: { select: { firstName: true, lastName: true } } } },
    }, orderBy: { createdAt: "asc" }, take: 5 }) : Promise.resolve([]),
  ]);
  return JSON.parse(JSON.stringify({ sales, draftCount, pendingPayments, taskCount, tasks, payments, updatedAt: new Date().toISOString() })) as DashboardData;
}, ["dashboard-v1"], { revalidate: 60, tags: ["dashboard"] });
