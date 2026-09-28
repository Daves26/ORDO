import { RoleCode } from "@prisma/client";
import { redirect } from "next/navigation";
import { currentUser, hasRole } from "@/lib/auth";
import { CustomerWorkspace } from "@/components/customer-workspace";

export default async function CustomersPage() {
  const actor = (await currentUser())!;
  if (!hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE)) redirect("/");
  return <CustomerWorkspace canCreate={hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE)} />;
}
