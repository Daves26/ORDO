import { notFound, redirect } from "next/navigation";
import { RoleCode } from "@prisma/client";
import { currentUser, hasRole, isAdministrator } from "@/lib/auth";
import { AppError } from "@/lib/http";
import { getSaleView } from "@/lib/sale-view";
import { SaleDetail } from "@/components/sale-detail";

export default async function SalePage({ params }: { params: Promise<{ id: string }> }) {
  const actor = (await currentUser())!; const { id } = await params;
  let initial;
  try { initial = await getSaleView(id, actor); }
  catch (error) {
    if (error instanceof AppError && error.status === 404) notFound();
    if (error instanceof AppError && error.status === 403) redirect("/ventas");
    throw error;
  }
  return <SaleDetail key={id} id={id} initial={initial} actorId={actor.id} canEditAllLocators={isAdministrator(actor) || actor.roles.includes(RoleCode.BACK_OFFICE)} canEdit={hasRole(actor, RoleCode.GERENTE) || (initial.sale.advisorId === actor.id && hasRole(actor, RoleCode.ASESOR))} canEditOperational={hasRole(actor, RoleCode.BACK_OFFICE)} canValidate={hasRole(actor, RoleCode.CONTABILIDAD)} canViewFinancial={hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD)} canDelete={isAdministrator(actor)} />;
}
