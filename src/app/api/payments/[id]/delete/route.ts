import { Prisma, RoleCode } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { authorize, payload, respond } from "@/lib/http";
import { assertDeletion, paymentDeletionPreview } from "@/lib/delete-preview";
import { deletePaymentGraph } from "@/lib/hard-delete";

type Context = { params: Promise<{ id: string }> };
const confirmation = z.object({ confirm: z.string(), fingerprint: z.string() });
const adminOnly = (actor: { roles: RoleCode[] }) => actor.roles.includes(RoleCode.ADMINISTRADOR);

export async function GET(request: Request, { params }: Context) {
  try {
    await authorize(request, adminOnly);
    const { id } = await params;
    return NextResponse.json(await paymentDeletionPreview(db, z.string().uuid().parse(id)));
  } catch (error) { return respond(error); }
}

export async function POST(request: Request, { params }: Context) {
  try {
    await authorize(request, adminOnly, true);
    const { id } = await params;
    const input = confirmation.parse(await payload(request));
    await db.$transaction(async (tx) => {
      const preview = await paymentDeletionPreview(tx, z.string().uuid().parse(id));
      assertDeletion(preview, input);
      await deletePaymentGraph(tx, id);
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 10_000, timeout: 30_000 });
    return NextResponse.json({ deleted: true });
  } catch (error) { return respond(error); }
}
