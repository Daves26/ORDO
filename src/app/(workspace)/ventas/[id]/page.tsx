import { notFound, redirect } from "next/navigation";
import { RoleCode } from "@prisma/client";
import { currentUser, hasRole, isAdministrator } from "@/lib/auth";
import { db } from "@/lib/db";
import { SaleDetail } from "@/components/sale-detail";

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = (await currentUser())!; const { id } = await params;
  const sale = await db.sale.findUnique({ where: { id }, select: { id: true, advisorId: true } });
  if (!sale) notFound();
  if (!hasRole(actor, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE) && sale.advisorId !== actor.id) redirect("/ventas");
  return <SaleDetail id={id} canEdit={(sale.advisorId === actor.id && hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE)) || hasRole(actor, RoleCode.GERENTE)} canValidate={hasRole(actor, RoleCode.CONTABILIDAD)} canViewFinancial={hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD)} canDelete={isAdministrator(actor)} />;
}
