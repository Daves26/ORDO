import { RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, authorize, respond } from "@/lib/http";

export async function GET(request: Request) {
  try {
    await authorize(request, (user) => hasRole(user, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD));
    const number = new URL(request.url).searchParams.get("number") ?? "";
    if (!/^[0-9]{4}$/.test(number)) throw new AppError(422, "Ingresa cuatro dígitos de OS.");
    const used = await db.sale.findUnique({ where: { number }, select: { id: true } });
    return NextResponse.json({ available: !used });
  } catch (error) { return respond(error); }
}
