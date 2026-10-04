import { RoleCode } from "@prisma/client";
import { hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { AppError, authorize, respond } from "@/lib/http";
import { assertCanIssueOrder } from "@/lib/order-document";
import { renderOrderPdf, type OrderSnapshot } from "@/lib/render-order-pdf";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; issueId: string }> };

export async function GET(request: Request, { params }: Context) {
  try {
    const actor = await authorize(request, (user) => hasRole(user, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD));
    const { id, issueId } = await params;
    const issue = await db.saleOrderIssue.findFirst({ where: { id: issueId, saleId: id }, include: { sale: { select: { advisorId: true } } } });
    if (!issue) throw new AppError(404, "Documento no encontrado.");
    assertCanIssueOrder(actor, issue.sale.advisorId);
    const snapshot = issue.snapshot as unknown as OrderSnapshot;
    const pdf = await renderOrderPdf(snapshot, issue.createdAt);
    return new Response(new Uint8Array(pdf), { headers: { "content-type": "application/pdf", "content-disposition": `inline; filename="OS-${snapshot.number}-${issue.id}.pdf"`, "cache-control": "private, no-store" } });
  } catch (error) { return respond(error); }
}
