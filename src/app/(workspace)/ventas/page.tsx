import Link from "next/link";
import { RoleCode } from "@prisma/client";
import { redirect } from "next/navigation";
import { currentUser, hasRole } from "@/lib/auth";
import { dashboardAccess } from "@/lib/dashboard-scope";
import { getSalesPageData, type SalesFilter } from "@/lib/sales-list";
import { date, money } from "@/lib/format";
import { saleLabel } from "@/lib/sale-number";

const filters: { value: SalesFilter; label: string }[] = [
  { value: "todas", label: "Todas" }, { value: "recientes", label: "Recientes" },
  { value: "borradores", label: "Borradores" }, { value: "abonos", label: "Abonos reportados" },
  { value: "tareas", label: "Tareas pendientes" },
];

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ q?: string; filtro?: string; pagina?: string }> }) {
  const actor = (await currentUser())!;
  if (!hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE)) redirect("/");
  const access = dashboardAccess(actor);
  const { q, filtro, pagina } = await searchParams;
  const term = q?.trim().slice(0, 80) ?? "";
  const allowed = filters.filter(({ value }) => value !== "borradores" || access.canSell).filter(({ value }) => value !== "abonos" || access.canViewFinancial);
  const selected = allowed.find(({ value }) => value === filtro)?.value ?? "todas";
  const requestedPage = Number(pagina);
  const { total, page, sales, payments, tasks, updatedAt } = await getSalesPageData(actor.id, [...actor.roles].sort(), selected, term, requestedPage);
  const pageUrl = (next: number) => `/ventas?${new URLSearchParams({ ...(selected !== "todas" ? { filtro: selected } : {}), ...(term ? { q: term } : {}), pagina: String(next) })}`;
  const heading = selected === "abonos" ? access.canValidate ? "Abonos por validar" : access.managesTeam ? "Abonos reportados del equipo" : "Mis abonos reportados" : selected === "tareas" ? "Tareas pendientes" : selected === "borradores" ? "Borradores por completar" : selected === "recientes" ? "Ventas recientes" : "Ventas";
  return <>
    <div className="page-heading"><div><span className="eyebrow">Expediente único</span><h1>{heading}</h1><p className="muted">{selected === "abonos" ? "Abonos reportados que esperan validación contable." : selected === "tareas" ? "Acciones pendientes en las órdenes a las que tienes acceso." : "Información comercial y próximos pasos de cada viaje."}</p></div>{access.canSell && <Link href="/ventas/nueva" className="btn btn-primary">+ Nueva venta</Link>}</div>
    <nav className="filter-links" aria-label="Filtrar ventas">{allowed.map(({ value, label }) => <Link key={value} href={`/ventas${value !== "todas" || term ? `?${new URLSearchParams({ ...(value !== "todas" ? { filtro: value } : {}), ...(term ? { q: term } : {}) })}` : ""}`} className={`btn ${selected === value ? "filter-active" : ""}`} aria-current={selected === value ? "page" : undefined}>{label}</Link>)}</nav>
    <form className="card" action="/ventas" style={{ display: "flex", gap: 12, marginBottom: 22 }}><label htmlFor="sale-query" className="sr-only">Buscar ventas</label><input className="search-field" id="sale-query" name="q" defaultValue={term} placeholder="OS, cliente, teléfono o destino" />{selected !== "todas" && <input type="hidden" name="filtro" value={selected} />}<button className="btn" type="submit">Buscar</button></form>
    <div className="card table-wrap"><p className="muted small" role="status">{selected === "recientes" ? `Mostrando las ${sales.length} ventas más recientes` : `${total} ${selected === "abonos" ? "abono(s)" : selected === "tareas" ? "tarea(s)" : "venta(s)"}${total > 50 ? ` · página ${page} de ${Math.ceil(total / 50)}` : ""}`} · Actualizado a las {new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit", timeZone: "America/Bogota" }).format(new Date(updatedAt))}</p>
      {(selected === "todas" || selected === "recientes" || selected === "borradores") && <><table><thead><tr><th>Orden de servicio</th><th>Cliente</th><th>Destino</th><th>Salida</th>{access.canViewFinancial && <th>Valor</th>}<th>Comercial</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td><Link style={{ color: "var(--primary)", fontWeight: 800 }} href={`/ventas/${sale.id}`}>{saleLabel(sale.number)}</Link></td><td>{sale.customer.firstName} {sale.customer.lastName}</td><td>{sale.destination}</td><td>{date(sale.startsAt)}</td>{access.canViewFinancial && <td>{money(sale.total.toString())}</td>}<td><span className={`pill ${sale.commercialStatus === "BORRADOR" ? "warning" : "success"}`}>{sale.commercialStatus}</span></td></tr>)}</tbody></table>{!sales.length && <p className="muted">No hay ventas que coincidan con la búsqueda.</p>}</>}
      {selected === "abonos" && (payments.length ? payments.map((payment) => <Link href={`/ventas/${payment.saleId}#abono-${payment.id}`} className="list-row" key={payment.id}><span><strong>{saleLabel(payment.sale.number)}</strong> · {payment.sale.customer.firstName} {payment.sale.customer.lastName}<br /><span className="muted small">{payment.sale.destination} · Reportado el {date(payment.paidAt)} · {payment.method}</span></span><span><strong>{money(payment.amount.toString())}</strong><br /><span className="pill warning">REPORTADO</span></span></Link>) : <p className="muted">No hay abonos reportados que coincidan con la búsqueda.</p>)}
      {selected === "tareas" && (tasks.length ? tasks.map((task) => <Link href={`/ventas/${task.saleId}#tarea-${task.id}`} className="list-row" key={task.id}><span><strong>{task.description}</strong><br /><span className="muted small">{saleLabel(task.sale.number)} · {task.sale.customer.firstName} {task.sale.customer.lastName} · {task.sale.destination}</span></span><span className="pill warning">PENDIENTE</span></Link>) : <p className="muted">No hay tareas pendientes que coincidan con la búsqueda.</p>)}
      {selected !== "recientes" && total > 50 && <nav className="form-actions" aria-label="Páginas de resultados">{page > 1 && <Link className="btn" href={pageUrl(page - 1)}>← Anterior</Link>}{page * 50 < total && <Link className="btn" href={pageUrl(page + 1)}>Siguiente →</Link>}</nav>}
    </div>
  </>;
}
