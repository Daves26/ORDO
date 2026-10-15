import Link from "next/link";
import { ArrowUpRight, BriefcaseBusiness, CalendarClock, CheckCircle2, ClipboardList, Settings, Sparkles } from "lucide-react";
import { currentUser } from "@/lib/auth";
import { dashboardAccess } from "@/lib/dashboard-scope";
import { getDashboardData } from "@/lib/dashboard-data";
import { date, money } from "@/lib/format";
import { saleLabel } from "@/lib/sale-number";

export default async function HomePage() {
  const actor = (await currentUser())!;
  const access = dashboardAccess(actor);
  const { sales, draftCount, pendingPayments, taskCount, tasks, payments, updatedAt } = await getDashboardData(actor.id, [...actor.roles].sort());
  const paymentTitle = access.canValidate ? "Abonos por validar" : access.managesTeam ? "Abonos reportados del equipo" : "Mis abonos reportados";
  const taskTitle = access.worksOperations && !access.managesTeam && !access.canValidate ? "Gestiones pendientes" : "Tareas pendientes";
  const priorityTitle = access.isAdministrator ? "Panorama general" : access.managesTeam ? "Panorama del equipo" : access.canValidate ? "Prioridad contable" : access.worksOperations ? "Prioridad operativa" : "Mi jornada comercial";
  const refreshedAt = new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" }).format(new Date(updatedAt));
  const taskBlock = <div><div className="page-heading" style={{ marginBottom: 8 }}><h3 className="priority-group-heading">{taskTitle}</h3><Link className="muted" href="/ventas?filtro=tareas">Ver tareas →</Link></div>
    {tasks.length ? tasks.map((task) => <Link href={`/ventas/${task.saleId}#tarea-${task.id}`} className="list-row" key={task.id}><span><span className="pill">{saleLabel(task.sale.number)}</span><br /><strong style={{ display: "inline-block", marginTop: 7 }}>{task.description}</strong></span><ArrowUpRight size={16} aria-hidden="true" /></Link>) : <p className="muted">No hay tareas pendientes en este momento.</p>}</div>;
  const paymentBlock = access.canViewFinancial && <div><div className="page-heading" style={{ marginBottom: 8 }}><h3 className="priority-group-heading">{paymentTitle}</h3><Link className="muted" href="/ventas?filtro=abonos">Ver abonos →</Link></div>
    {payments.length ? payments.map((payment) => <Link href={`/ventas/${payment.saleId}#abono-${payment.id}`} className="list-row" key={payment.id}><span><strong>{saleLabel(payment.sale.number)}</strong><br /><span className="muted small">{payment.sale.customer.firstName} {payment.sale.customer.lastName} · {date(payment.paidAt)}</span></span><strong>{money(payment.amount.toString())}</strong></Link>) : <p className="muted">No hay abonos reportados pendientes.</p>}</div>;
  return <>
    <div className="page-heading"><div><span className="eyebrow">Espacio de trabajo</span><h1>Buen día, {actor.name.split(" ")[0]} <Sparkles size={27} color="var(--secondary)" aria-hidden="true" /></h1><p className="muted" style={{ margin: 0 }}>{priorityTitle} · Pendientes y accesos directos a tus expedientes.</p><span className="muted small">Indicadores actualizados a las {refreshedAt} · hasta 1 minuto de vigencia</span></div>{access.canSell && <Link className="btn btn-primary" href="/ventas/nueva">Crear una venta <ArrowUpRight size={16} aria-hidden="true" /></Link>}</div>
    <div className="grid stats" aria-label="Accesos a tus indicadores">
      {access.canValidate && <Link className="card card-hover stat-link" href="/ventas?filtro=abonos"><span className="stat-icon"><CheckCircle2 size={20} aria-hidden="true" /></span><span className="stat-number">{pendingPayments}</span><span className="muted">{paymentTitle}</span><ArrowUpRight className="stat-arrow" size={18} aria-hidden="true" /></Link>}
      {access.canSell && <Link className="card card-hover stat-link" href="/ventas?filtro=borradores"><span className="stat-icon"><CalendarClock size={20} aria-hidden="true" /></span><span className="stat-number">{draftCount}</span><span className="muted">{access.managesTeam ? "Borradores del equipo" : "Mis borradores por completar"}</span><ArrowUpRight className="stat-arrow" size={18} aria-hidden="true" /></Link>}
      <Link className="card card-hover stat-link" href="/ventas?filtro=tareas"><span className="stat-icon"><ClipboardList size={20} aria-hidden="true" /></span><span className="stat-number">{taskCount}</span><span className="muted">{taskTitle}</span><ArrowUpRight className="stat-arrow" size={18} aria-hidden="true" /></Link>
      {access.canViewFinancial && !access.canValidate && <Link className="card card-hover stat-link" href="/ventas?filtro=abonos"><span className="stat-icon"><CheckCircle2 size={20} aria-hidden="true" /></span><span className="stat-number">{pendingPayments}</span><span className="muted">{paymentTitle}</span><ArrowUpRight className="stat-arrow" size={18} aria-hidden="true" /></Link>}
      <Link className="card card-hover stat-link" href="/ventas?filtro=recientes"><span className="stat-icon"><BriefcaseBusiness size={20} aria-hidden="true" /></span><span className="stat-number">{sales.length}{sales.length === 8 ? "+" : ""}</span><span className="muted">Ventas recientes</span><ArrowUpRight className="stat-arrow" size={18} aria-hidden="true" /></Link>
    </div>
    <div className="grid split">
      <section className="card"><h2>Requiere atención</h2>
        {access.canValidate ? <>{paymentBlock}<div style={{ marginTop: 26 }}>{taskBlock}</div></> : <>{taskBlock}{paymentBlock && <div style={{ marginTop: 26 }}>{paymentBlock}</div>}</>}
      </section>
      <section className="card"><div className="page-heading" style={{ marginBottom: 8 }}><h2>Ventas recientes</h2><Link className="muted" href="/ventas">Ver todas →</Link></div>{sales.length ? sales.map((sale) => <Link href={`/ventas/${sale.id}`} key={sale.id} className="list-row"><div><strong>{saleLabel(sale.number)}</strong><div className="muted small">{sale.customer.firstName} {sale.customer.lastName} · {sale.destination}</div></div><div style={{ textAlign: "right" }}>{access.canViewFinancial && <strong>{money(sale.total.toString())}</strong>}<div className="muted small">{date(sale.startsAt)}</div></div></Link>) : <p className="muted">Aquí aparecerán tus primeras ventas.</p>}
        {access.isAdministrator && <Link href="/usuarios" className="list-row" style={{ marginTop: 20 }}><span><Settings size={16} aria-hidden="true" /> Gestionar usuarios</span><ArrowUpRight size={16} aria-hidden="true" /></Link>}
      </section>
    </div>
  </>;
}
