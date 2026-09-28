import Link from "next/link";
import { CalendarClock, CheckCircle2, CircleDollarSign, ArrowUpRight, Sparkles } from "lucide-react";
import { RoleCode } from "@prisma/client";
import { currentUser, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { date, money } from "@/lib/format";
import { saleLabel } from "@/lib/sale-number";

export default async function HomePage() {
  const actor = (await currentUser())!;
  const financial = hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD);
  const global = hasRole(actor, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE);
  const where = global ? {} : { advisorId: actor.id };
  const [sales, draftCount, pendingPayments, tasks] = await Promise.all([
    db.sale.findMany({ where, orderBy: { createdAt: "desc" }, take: 8, include: { customer: { select: { firstName: true, lastName: true } } } }),
    db.sale.count({ where: { ...where, commercialStatus: "BORRADOR" } }),
    db.customerPayment.count({ where: { status: "REPORTADO", ...(global ? {} : { sale: { advisorId: actor.id } }) } }),
    db.task.findMany({ where: { status: "PENDIENTE", ...(hasRole(actor, RoleCode.GERENTE) ? {} : hasRole(actor, RoleCode.CONTABILIDAD) ? { OR: [{ assignedRole: RoleCode.CONTABILIDAD }, { assigneeId: actor.id }] } : hasRole(actor, RoleCode.BACK_OFFICE) ? { OR: [{ assignedRole: RoleCode.BACK_OFFICE }, { assigneeId: actor.id }] } : { OR: [{ assigneeId: actor.id }, { assignedRole: RoleCode.ASESOR, sale: { advisorId: actor.id } }] }) }, include: { sale: { select: { number: true, advisorId: true } } }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const canSell = hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE);
  return <>
    <div className="page-heading"><div><span className="eyebrow">Espacio de trabajo</span><h1>Buen día, {actor.name.split(" ")[0]} <Sparkles size={27} color="#7c3aed" aria-hidden="true" /></h1><p className="muted" style={{ margin: 0 }}>Lo importante de tu operación, sin controles dispersos.</p></div>{canSell && <Link className="btn btn-primary" href="/ventas/nueva">Crear una venta <ArrowUpRight size={16} aria-hidden="true" /></Link>}</div>
    <div className="grid stats"><div className="card"><div className="stat-icon"><CircleDollarSign size={20} /></div><div className="stat-number">{sales.length}{sales.length === 8 ? "+" : ""}</div><span className="muted">Ventas recientes</span></div><div className="card"><div className="stat-icon"><CalendarClock size={20} /></div><div className="stat-number">{draftCount}</div><span className="muted">Borradores por completar</span></div><div className="card"><div className="stat-icon"><CheckCircle2 size={20} /></div><div className="stat-number">{financial ? pendingPayments : tasks.length}</div><span className="muted">{financial ? "Abonos por validar" : "Tareas pendientes"}</span></div></div>
    <div className="grid split"><section className="card"><div className="page-heading" style={{ marginBottom: 8 }}><h2>Ventas recientes</h2><Link className="muted" href="/ventas">Ver todas →</Link></div>{sales.length ? sales.map((sale) => <Link href={`/ventas/${sale.id}`} key={sale.id} className="list-row"><div><strong>{saleLabel(sale.number)}</strong><div className="muted small">{sale.customer.firstName} {sale.customer.lastName} · {sale.destination}</div></div><div style={{ textAlign: "right" }}>{financial && <strong>{money(sale.total.toString())}</strong>}<div className="muted small">{date(sale.startsAt)}</div></div></Link>) : <p className="muted">Aquí aparecerán tus primeras ventas.</p>}</section><section className="card"><h2>Pendientes</h2>{tasks.length ? tasks.map((task) => <Link href={`/ventas/${task.saleId}`} className="list-row" key={task.id}><span><span className="pill">{saleLabel(task.sale.number)}</span><br /><strong style={{ display: "inline-block", marginTop: 7 }}>{task.description}</strong></span><ArrowUpRight size={16} aria-hidden="true" /></Link>) : <p className="muted">No tienes tareas pendientes en este momento.</p>}{financial && pendingPayments > 0 && <div className="notice warning" style={{ marginTop: 18 }}>{pendingPayments} abono(s) esperando validación contable.</div>}</section></div>
  </>;
}
