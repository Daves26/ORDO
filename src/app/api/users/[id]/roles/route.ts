import { Prisma, RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, authorize, payload, respond } from "@/lib/http";

type Context = { params: Promise<{ id: string }> };
const schema = z.object({
  version: z.number().int().positive(),
  roles: z.array(z.nativeEnum(RoleCode)).min(1, "Selecciona al menos un rol.").max(Object.keys(RoleCode).length),
  reason: z.string().trim().min(3, "Explica por qué cambias los roles.").max(300),
});

export async function PATCH(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.ADMINISTRADOR), true);
    const { id } = await params;
    const input = schema.parse(await payload(request));
    const selected = [...new Set(input.roles)].sort();
    const updated = await db.$transaction(async (tx) => {
      // A role revoked in another request must take effect before this request can grant roles.
      const currentAdministrator = await tx.userRole.findFirst({ where: { userId: actor.id, role: { code: RoleCode.ADMINISTRADOR } }, select: { userId: true } });
      if (!currentAdministrator) throw new AppError(403, "Ya no tienes permiso para editar roles. Actualiza la página.");

      const target = await tx.user.findUnique({ where: { id }, include: { roles: { include: { role: true } } } });
      if (!target) throw new AppError(404, "Usuario no encontrado.");
      if (target.version !== input.version) throw new AppError(409, "Los roles de este usuario cambiaron. Recarga antes de guardar.");
      const previous = target.roles.map(({ role }) => role.code).sort();
      if (previous.join("|") === selected.join("|")) throw new AppError(409, "No hay cambios de roles para guardar.");

      if (target.active && previous.includes(RoleCode.ADMINISTRADOR) && !selected.includes(RoleCode.ADMINISTRADOR)) {
        const activeAdministrators = await tx.user.count({ where: { active: true, roles: { some: { role: { code: RoleCode.ADMINISTRADOR } } } } });
        if (activeAdministrators <= 1) throw new AppError(409, "No puedes retirar el rol al último administrador activo.");
      }
      const roles = await tx.role.findMany({ where: { code: { in: selected } }, select: { id: true, code: true } });
      if (roles.length !== selected.length) throw new AppError(422, "Hay roles que no existen en el catálogo.");
      const roleIds = roles.map((role) => role.id);
      const user = await tx.user.update({ where: { id, version: input.version }, data: { version: { increment: 1 } } });
      await tx.userRole.deleteMany({ where: { userId: id, roleId: { notIn: roleIds } } });
      await tx.userRole.createMany({ data: roleIds.map((roleId) => ({ userId: id, roleId })), skipDuplicates: true });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "User", entityId: id, action: "MODIFICAR_ROLES", before: { roles: previous }, after: { roles: selected }, reason: input.reason } });
      return user;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 10_000 });

    return NextResponse.json({ user: { id: updated.id, version: updated.version, roles: selected } });
  } catch (error) { return respond(error); }
}
