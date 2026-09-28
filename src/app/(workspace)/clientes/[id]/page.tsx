import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RoleCode } from "@prisma/client";
import { currentUser, hasRole, isAdministrator } from "@/lib/auth";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { date, money } from "@/lib/format";
import { saleLabel } from "@/lib/sale-number";
import { CustomerEditor } from "@/components/customer-editor";
import { DeleteCustomer } from "@/components/delete-customer";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = (await currentUser())!;
  if (!hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD, RoleCode.BACK_OFFICE)) redirect("/");
  const { id } = await params;
  const customer = await db.customer.findUnique({ where: { id }, include: { sales: { orderBy: { createdAt: "desc" } }, changes: { orderBy: { createdAt: "desc" }, take: 30 } } });
  if (!customer) notFound();
  const financial = hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE, RoleCode.CONTABILIDAD);
  return <><Link href="/clientes" className="muted small"><ArrowLeft size={14} aria-hidden="true" /> Clientes</Link><div className="page-heading"><div><span className="eyebrow">{customer.code}</span><h1>{customer.firstName} {customer.lastName}</h1><p className="muted">Ficha maestra · {customer.sales.length} venta(s) registrada(s)</p></div>{isAdministrator(actor) && <DeleteCustomer id={id} />}</div><div className="grid split"><section className="card"><h2>Datos actuales</h2><div className="list-row"><span className="muted">Documento</span><strong>{customer.documentType ?? "Pendiente"} {customer.documentNumber ?? ""}</strong></div><div className="list-row"><span className="muted">Teléfono</span><strong>{customer.phone}</strong></div><div className="list-row"><span className="muted">Correo</span><strong>{customer.email ?? "Pendiente"}</strong></div><div className="list-row"><span className="muted">Ciudad</span><strong>{customer.city ?? "Pendiente"}</strong></div><div className="list-row"><span className="muted">Creación</span><strong>{date(customer.createdAt)}</strong></div></section><section className="card"><h2>Historial de ventas</h2>{customer.sales.length ? customer.sales.map((sale) => <Link className="list-row" href={`/ventas/${sale.id}`} key={sale.id}><span><strong>{saleLabel(sale.number)}</strong><br /><span className="muted small">{sale.destination} · {date(sale.startsAt)}</span></span>{financial && <strong>{money(sale.total.toString())}</strong>}</Link>) : <p className="muted">Este cliente todavía no tiene ventas.</p>}</section></div>{hasRole(actor, RoleCode.ASESOR, RoleCode.GERENTE) && <CustomerEditor id={id} initial={{ version: customer.version, firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone, email: customer.email ?? "", documentType: customer.documentType ?? "", documentNumber: customer.documentNumber ?? "", city: customer.city ?? "", address: customer.address ?? "" }} />}{financial && customer.changes.length > 0 && <section className="card" style={{ marginTop: 20 }}><h2>Cambios de la ficha</h2>{customer.changes.map((change) => <div className="list-row" key={change.id}><span><strong>{change.field}</strong> · {change.oldValue ?? "Vacío"} → {change.newValue ?? "Vacío"}</span><span className="muted small">{date(change.createdAt)}</span></div>)}</section>}</>;
}
