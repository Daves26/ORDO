import { redirect } from "next/navigation";
import { RoleCode } from "@prisma/client";
import { currentUser, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { QuickSaleForm } from "@/components/quick-sale-form";

export default async function NewSalePage() {
  const actor = (await currentUser())!;
  if (!hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE)) redirect("/ventas");
  const advisors = actor.roles.includes(RoleCode.ADMINISTRADOR) ? await db.user.findMany({
    where: { active: true, roles: { some: { role: { code: { in: [RoleCode.ASESOR, RoleCode.GERENTE] } } } } },
    select: { id: true, name: true }, orderBy: { name: "asc" },
  }) : [];
  return <><div className="page-heading"><div><span className="eyebrow">Captura rápida · Asesor: {actor.name}</span><h1>Nueva venta</h1><p className="muted">Crea el expediente ahora. Completa los detalles después.</p></div></div><QuickSaleForm supportAdvisors={actor.roles.includes(RoleCode.ADMINISTRADOR) ? [{ id: actor.id, name: `${actor.name} (mi cuenta)` }, ...advisors.filter(({ id }) => id !== actor.id)] : undefined} /></>;
}
