import { redirect } from "next/navigation";
import { RoleCode } from "@prisma/client";
import { currentUser, hasRole } from "@/lib/auth";
import { UsersAdmin } from "@/components/users-admin";
import { db } from "@/lib/db";

export default async function UsersPage() {
  const actor = (await currentUser())!;
  if (!hasRole(actor, RoleCode.ADMINISTRADOR)) redirect("/");
  const users = await db.user.findMany({ select: { id: true, name: true, email: true, active: true, version: true, roles: { select: { role: { select: { code: true } } } } }, orderBy: { name: "asc" } });
  return <UsersAdmin ownId={actor.id} initialUsers={users} />;
}
