import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { NextResponse } from "next/server";
import { currentUser, sameOrigin, type Actor } from "@/lib/auth";

export class AppError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}

export async function authorize(request: Request, allowed: (actor: Actor) => boolean, write = false) {
  const actor = await currentUser();
  if (!actor) throw new AppError(401, "Inicia sesión para continuar.");
  if (!allowed(actor)) throw new AppError(403, "No tienes permiso para esta acción.");
  if (write && !sameOrigin(request)) throw new AppError(403, "Origen de solicitud no permitido.");
  return actor;
}

export async function payload(request: Request) {
  try { return await request.json() as unknown; }
  catch { throw new AppError(400, "El cuerpo de la solicitud no es JSON válido."); }
}

export function respond(error: unknown) {
  if (error instanceof AppError) return NextResponse.json({ error: error.message, details: error.details }, { status: error.status });
  if (error instanceof ZodError) return NextResponse.json({ error: "Revisa los campos indicados.", details: error.flatten() }, { status: 422 });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return NextResponse.json({ error: "Ya existe un registro con estos datos." }, { status: 409 });
    if (error.code === "P2025") return NextResponse.json({ error: "Registro no encontrado o modificado por otra persona." }, { status: 409 });
    if (error.code === "P2028" || error.code === "P2034") return NextResponse.json({ error: "La operación cambió mientras se procesaba. Reintenta o recarga el expediente." }, { status: 409 });
  }
  console.error(error);
  return NextResponse.json({ error: "Ocurrió un error inesperado." }, { status: 500 });
}
