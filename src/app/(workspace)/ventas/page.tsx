import Link from "next/link";
import { RoleCode } from "@prisma/client";
import { redirect } from "next/navigation";
import { currentUser, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import { date, money } from "@/lib/format";
import { saleLabel, saleSearchNumber } from "@/lib/sale-number";

export default async function SalesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const actor = (await currentUser())!; const { q } = await searchParams;
  if (!hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE)) redirect("/");
  const term = q?.trim().slice(0, 80) ?? "";
  const orderQuery = saleSearchNumber(term);
  const words = term.split(/\s+/).filter(Boolean);
  const own = !hasRole(actor, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE);
  const sales = await db.sale.findMany({ where: {
    ...(own ? { advisorId: actor.id } : {}),
    ...(term ? { OR: [{ number: { contains: orderQuery, mode: "insensitive" } }, { destination: { contains: term, mode: "insensitive" } }, { customer: { OR: [{ firstName: { contains: term, mode: "insensitive" } }, { lastName: { contains: term, mode: "insensitive" } }, { documentNumber: { contains: term } }, { phone: { contains: term } }, ...(words.length > 1 ? [{ AND: [{ firstName: { contains: words[0], mode: "insensitive" as const } }, { lastName: { contains: words.slice(1).join(" "), mode: "insensitive" as const } }] }] : [])] } }] } : {}),
  }, include: { customer: true }, orderBy: { createdAt: "desc" }, take: 50 });
  const financial = hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD);
  return <><div className="page-heading"><div><span className="eyebrow">Expediente único</span><h1>Ventas</h1><p className="muted">Información comercial y próximos pasos de cada viaje.</p></div>{hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE) && <Link href="/ventas/nueva" className="btn btn-primary">+ Nueva venta</Link>}</div><form className="card" action="/ventas" style={{ display: "flex", gap: 12, marginBottom: 22 }}><label htmlFor="sale-query" className="sr-only">Buscar ventas</label><input className="search-field" id="sale-query" name="q" defaultValue={term} placeholder="OS, cliente, teléfono o destino" /><button className="btn" type="submit">Buscar</button></form><div className="card table-wrap"><table><thead><tr><th>Orden de servicio</th><th>Cliente</th><th>Destino</th><th>Salida</th>{financial && <th>Valor</th>}<th>Comercial</th></tr></thead><tbody>{sales.map((sale) => <tr key={sale.id}><td><Link style={{ color: "var(--primary)", fontWeight: 800 }} href={`/ventas/${sale.id}`}>{saleLabel(sale.number)}</Link></td><td>{sale.customer.firstName} {sale.customer.lastName}</td><td>{sale.destination}</td><td>{date(sale.startsAt)}</td>{financial && <td>{money(sale.total.toString())}</td>}<td><span className={`pill ${sale.commercialStatus === "BORRADOR" ? "warning" : "success"}`}>{sale.commercialStatus}</span></td></tr>)}</tbody></table>{sales.length === 0 && <p className="muted">No hay ventas que coincidan con la búsqueda.</p>}</div></>;
}
