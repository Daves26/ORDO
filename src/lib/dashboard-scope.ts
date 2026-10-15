import { Prisma, RoleCode } from "@prisma/client";
import { hasRole, type Actor } from "@/lib/auth";

export function dashboardAccess(actor: Actor) {
  return {
    canSell: hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE),
    canViewFinancial: hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD),
    canValidate: hasRole(actor, RoleCode.CONTABILIDAD),
    managesTeam: hasRole(actor, RoleCode.GERENTE),
    worksOperations: actor.roles.includes(RoleCode.BACK_OFFICE) || actor.roles.includes(RoleCode.ADMINISTRADOR),
    isAdministrator: actor.roles.includes(RoleCode.ADMINISTRADOR),
  };
}

export function dashboardSaleScope(actor: Actor): Prisma.SaleWhereInput {
  return hasRole(actor, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE) ? {} : { advisorId: actor.id };
}

export function dashboardPaymentScope(actor: Actor): Prisma.CustomerPaymentWhereInput {
  return { status: "REPORTADO", sale: { is: dashboardSaleScope(actor) } };
}

export function dashboardTaskScope(actor: Actor): Prisma.TaskWhereInput {
  if (hasRole(actor, RoleCode.GERENTE)) return { status: "PENDIENTE" };
  const roles = [RoleCode.ASESOR, RoleCode.BACK_OFFICE, RoleCode.CONTABILIDAD].filter((role) => actor.roles.includes(role));
  return { status: "PENDIENTE", sale: { is: dashboardSaleScope(actor) }, OR: [
    { assigneeId: actor.id },
    ...roles.map((role) => role === RoleCode.ASESOR
      ? { assignedRole: role, sale: { is: { advisorId: actor.id } } }
      : { assignedRole: role }),
  ] };
}
