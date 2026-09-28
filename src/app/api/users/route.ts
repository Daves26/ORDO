import { hash } from "bcryptjs";
import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { authorize, payload, respond } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await authorize(request, (actor) => hasRole(actor, RoleCode.ADMINISTRADOR));
    const users = await db.user.findMany({ select: { id: true, name: true, email: true, active: true, version: true, roles: { select: { role: { select: { code: true } } } } }, orderBy: { name: "asc" } });
    return NextResponse.json({ users });
  } catch (error) { return respond(error); }
}

export async function POST(request: Request) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.ADMINISTRADOR), true);
    const input = z.object({ name: z.string().trim().min(2).max(120), email: z.string().email().transform((v) => v.toLowerCase()), password: z.string().min(12), roles: z.array(z.nativeEnum(RoleCode)).min(1).max(5) }).parse(await payload(request));
    const user = await db.$transaction(async (tx) => {
      const created = await tx.user.create({ data: { name: input.name, email: input.email, passwordHash: await hash(input.password, 12), roles: { create: [...new Set(input.roles)].map((code) => ({ role: { connect: { code } } })) } } });
      await tx.auditLog.create({ data: { actorId: actor.id, entity: "User", entityId: created.id, action: "CREAR", after: { email: created.email, roles: input.roles } } });
      return created;
    });
    return NextResponse.json({ id: user.id }, { status: 201 });
  } catch (error) { return respond(error); }
}
