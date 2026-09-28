import { redirect } from "next/navigation";
import { RoleCode } from "@prisma/client";
import { currentUser, hasRole } from "@/lib/auth";
import { UsersAdmin } from "@/components/users-admin";

export default async function UsersPage() {
  const actor = (await currentUser())!;
  if (!hasRole(actor, RoleCode.ADMINISTRADOR)) redirect("/");
  return <UsersAdmin ownId={actor.id} />;
}
