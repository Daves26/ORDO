import { NextResponse } from "next/server";
import { z } from "zod";
import { signIn, sameOrigin } from "@/lib/auth";
import { AppError, payload, respond } from "@/lib/http";

export async function POST(request: Request) {
  try {
    if (!sameOrigin(request)) throw new AppError(403, "Origen no permitido.");
    const input = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(await payload(request));
    if (!await signIn(input.email, input.password)) throw new AppError(401, "Credenciales inválidas o acceso temporalmente bloqueado.");
    return NextResponse.json({ ok: true });
  } catch (error) { return respond(error); }
}
