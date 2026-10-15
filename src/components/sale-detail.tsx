"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import dynamic from "next/dynamic";
import { ArrowLeft, CalendarClock, CheckCircle2, CircleAlert, Wallet } from "lucide-react";
import { date, money } from "@/lib/format";
import { DraftEditor } from "@/components/draft-editor";
import { PaymentForm } from "@/components/payment-form";
import { saleLabel, isOrderNumber } from "@/lib/sale-number";
import { useRouter } from "next/navigation";
import { SaleLocators, type LocatorItem } from "@/components/sale-locators";
import { serviceLabel } from "@/lib/service-types";
import { SaleOrderDetails } from "@/components/sale-order-details";
import type { SaleView } from "@/lib/sale-view-types";

const dialogLoading = () => <div className="dialog-backdrop" role="status"><div className="dialog">Preparando formulario…</div></div>;
const PaymentValidationDialog = dynamic(() => import("@/components/payment-validation-dialog").then((module) => module.PaymentValidationDialog), { ssr: false, loading: dialogLoading });
const PaymentAmountDialog = dynamic(() => import("@/components/payment-amount-dialog").then((module) => module.PaymentAmountDialog), { ssr: false, loading: dialogLoading });
const SaleOrderDialog = dynamic(() => import("@/components/sale-order-dialog").then((module) => module.SaleOrderDialog), { ssr: false, loading: dialogLoading });
const DeleteDialog = dynamic(() => import("@/components/delete-dialog").then((module) => module.DeleteDialog), { ssr: false, loading: dialogLoading });
type CustomerPayment = SaleView["sale"]["payments"][number];

export function SaleDetail({ id, initial, actorId, canEditAllLocators, canEdit, canEditOperational, canValidate, canViewFinancial, canDelete = false }: { id: string; initial: SaleView; actorId: string; canEditAllLocators: boolean; canEdit: boolean; canEditOperational: boolean; canValidate: boolean; canViewFinancial: boolean; canDelete?: boolean }) {
  const router = useRouter();
  const [data, setData] = useState<SaleView>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [validating, setValidating] = useState<CustomerPayment | null>(null);
  const validateTrigger = useRef<HTMLButtonElement | null>(null);
  const [correcting, setCorrecting] = useState<CustomerPayment | null>(null);
  const correctionTrigger = useRef<HTMLButtonElement | null>(null);
  const [editingOrder, setEditingOrder] = useState(false);
  const orderTrigger = useRef<HTMLButtonElement | null>(null);
  const [deleting, setDeleting] = useState<{ endpoint: string; sale: boolean } | null>(null);
  useEffect(() => { setData(initial); }, [initial]);
  const load = useCallback(async () => {
    const response = await fetch(`/api/sales/${id}`);
    if (response.ok) setData(await response.json());
    else setError("No fue posible abrir el expediente.");
  }, [id]);
  useEffect(() => {
    if (!data || !/^#(abono|tarea)-/.test(window.location.hash)) return;
    document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "center" });
  }, [data]);

  async function register() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/sales/${id}/register`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) setError(result.details?.gaps ? `Falta: ${result.details.gaps.join(", ")}.` : result.error);
      else await load();
    } catch { setError("No fue posible registrar la venta."); }
    finally { setBusy(false); }
  }

  function closeValidation() {
    setValidating(null);
    requestAnimationFrame(() => validateTrigger.current?.focus());
  }
  function closeCorrection() { setCorrecting(null); requestAnimationFrame(() => correctionTrigger.current?.focus()); }
  function closeOrder() { setEditingOrder(false); requestAnimationFrame(() => orderTrigger.current?.focus()); }

  const { sale } = data;
  return <>
    <Link href="/ventas" className="muted small"><ArrowLeft size={14} aria-hidden="true" /> Ventas</Link>
    <div className="page-heading"><div><span className="eyebrow">Expediente único</span><h1>{saleLabel(sale.number)}</h1><p className="muted">{sale.destination} · {sale.customer.firstName} {sale.customer.lastName} · Asesor: {sale.advisor.name}</p></div><span style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}><span className={`pill ${sale.commercialStatus === "BORRADOR" ? "warning" : "success"}`}>{sale.commercialStatus === "BORRADOR" ? "Información pendiente" : "Venta registrada"}</span>{canDelete && <button className="btn btn-danger" onClick={() => setDeleting({ endpoint: `/api/sales/${id}/delete`, sale: true })}>Eliminar OS</button>}</span></div>
    {!isOrderNumber(sale.number) && <p className="notice warning">Este expediente anterior aún no tiene asignado el número real de la orden de servicio.{canValidate ? " Contabilidad puede registrarlo aquí." : " Solicita a contabilidad que lo registre."}</p>}
    {canValidate && <div style={{ marginBottom: 20 }}><button type="button" className="btn" onClick={(event) => { orderTrigger.current = event.currentTarget; setEditingOrder(true); }}>{isOrderNumber(sale.number) ? "Corregir OS" : "Asignar OS real"}</button></div>}
    {error && <p className="notice error" role="alert">{error}</p>}
    {canViewFinancial && <div className="grid stats">
      <div className="card"><div className="stat-icon"><Wallet size={20} /></div><div className="stat-number">{money(sale.total ?? 0)}</div><span className="muted">Valor venta · COP</span></div>
      <div className="card"><div className="stat-icon"><CheckCircle2 size={20} /></div><div className="stat-number">{money(data.validated)}</div><span className="muted">Cobros validados</span></div>
      <div className="card"><div className="stat-icon"><CalendarClock size={20} /></div><div className="stat-number">{money(data.balance)}</div><span className="muted">Saldo contable · {data.portfolioStatus.replaceAll("_", " ")}</span></div>
    </div>}
    <div className="grid split"><section className="card">
      <h2>Información de la venta</h2>
      <div className="list-row"><span className="muted">Cliente</span><Link style={{ color: "var(--primary)", fontWeight: 700 }} href={`/clientes/${sale.customer.id}`}>{sale.customer.firstName} {sale.customer.lastName} →</Link></div>
      <div className="list-row"><span className="muted">Servicios incluidos</span><strong style={{ textAlign: "right" }}>{sale.services.length ? sale.services.map((service) => serviceLabel(service.type)).join(", ") : sale.serviceType ? `${serviceLabel(sale.serviceType)} (sin desglose)` : "Pendientes"}</strong></div>
      <div className="list-row"><span className="muted">Observaciones de la orden</span><span style={{ maxWidth: "65%", textAlign: "right", whiteSpace: "pre-wrap" }}>{sale.notes || "Sin observaciones"}</span></div>
      <div className="list-row"><span className="muted">Salida</span><strong>{date(sale.startsAt)}</strong></div>
      <div className="list-row"><span className="muted">Regreso</span><strong>{date(sale.endsAt)}</strong></div>
      {canViewFinancial && <>
        <div className="list-row"><span className="muted">Pago máximo cliente</span><strong>{date(sale.customerDueAt ?? null)}</strong></div>
        <h2 id="movimientos-cliente" style={{ marginTop: 28 }}>Movimientos del cliente</h2>
        {sale.payments.length ? sale.payments.map((payment) => <div className="list-row" id={`abono-${payment.id}`} key={payment.id}>
          <span><strong>{money(payment.amount)}</strong><br /><span className="muted small">{payment.method} · {date(payment.paidAt)}</span>{payment.receipt && <><br /><span className="small">Recibo de caja: <strong>{payment.receipt.number}</strong></span></>}{payment.status === "VALIDADO" && !payment.receipt && <><br /><span className="muted small">Recibo pendiente de asociar (registro anterior)</span></>}{payment.corrections?.length > 0 && <details className="small" style={{ marginTop: 8 }}><summary style={{ cursor: "pointer", color: "var(--primary)", fontWeight: 700 }}>Ver {payment.corrections.length} corrección(es)</summary>{payment.corrections.map((item, index) => <div key={`${item.createdAt}-${index}`} style={{ paddingTop: 8 }}>{money(item.previousAmount)} → {money(item.newAmount)} · {item.reason} · {item.actor.name} · {date(item.createdAt)}</div>)}</details>}</span>
          <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "end" }}><span className={`pill ${payment.status === "VALIDADO" ? "success" : "warning"}`}>{payment.status}</span>{canValidate && (payment.status === "REPORTADO" || payment.status === "VALIDADO") && <button type="button" className="btn" disabled={busy} onClick={(event) => { correctionTrigger.current = event.currentTarget; setCorrecting(payment); }}>Corregir valor</button>}{canValidate && payment.status === "REPORTADO" && <button className="btn" disabled={busy} onClick={(event) => { validateTrigger.current = event.currentTarget; setValidating(payment); }}>Validar</button>}{canDelete && <button className="btn btn-danger" type="button" onClick={() => setDeleting({ endpoint: `/api/payments/${payment.id}/delete`, sale: false })}>Eliminar abono{payment.receipt ? " y recibo" : ""}</button>}</span>
        </div>) : <p className="muted">No hay pagos registrados.</p>}
        {sale.receipts?.filter(({ paymentId }) => !paymentId).map((receipt) => <div className="list-row" key={receipt.id}><span>Recibo de caja <strong>{receipt.number}</strong> · Sin abono vinculado</span>{canDelete && <button type="button" className="btn btn-danger" onClick={() => setDeleting({ endpoint: `/api/receipts/${receipt.id}/delete`, sale: false })}>Eliminar recibo</button>}</div>)}
        {data.pending > 0 && <div className="notice warning" style={{ marginTop: 18 }}>Hay {money(data.pending)} reportados sin validar. Si contabilidad los valida, el saldo proyectado será {money(data.projectedBalance)}.</div>}
        {(canEdit || canValidate) && data.balance > 0 && <PaymentForm id={id} max={data.projectedBalance} saved={load} />}
      </>}
    </section><aside>
       <section className="card"><h2>Siguiente paso</h2>{data.gaps.length ? <><p className="muted">Antes de registrar la venta falta:</p>{data.gaps.map((gap) => <div className="list-row" key={gap}><span><CircleAlert size={15} color="var(--warning)" aria-hidden="true" /> {gap}</span><span className="pill warning">Pendiente</span></div>)}<p className="muted small">Los datos se completarán en el formulario del expediente.</p></> : <div className="notice success">Los mínimos comerciales están completos.</div>}{canEdit && sale.commercialStatus === "BORRADOR" && <button style={{ marginTop: 20, width: "100%" }} className="btn btn-primary" onClick={register} disabled={busy || data.gaps.length > 0}>Registrar venta</button>}</section>
       <section className="card" style={{ marginTop: 20 }}><h2>Tareas del expediente</h2>{sale.tasks.length ? sale.tasks.map((task) => <div className="list-row" id={`tarea-${task.id}`} key={task.id}><span>{task.description}<br /><span className="muted small">{task.assignedRole?.replaceAll("_", " ") ?? "Asignada"}</span></span><span className="pill">{task.status}</span></div>) : <p className="muted">Las tareas se generarán cuando haya acciones pendientes.</p>}</section>
    </aside></div>
    <SaleLocators saleId={id} services={sale.services} locators={sale.locators as LocatorItem[]} actorId={actorId} canEditAll={canEditAllLocators} canDelete={canDelete} saved={load} />
    <SaleOrderDetails saleId={id} initial={{ version: sale.version, passengers: sale.passengers }} canEditOperational={canEdit || canEditOperational} saved={load} />
    {canEdit && sale.commercialStatus === "BORRADOR" && <div style={{ marginTop: 20 }}><DraftEditor id={id} sale={{ ...sale, total: sale.total ?? "0", customerDueAt: sale.customerDueAt ?? null }} saved={load} /></div>}
    {validating && <PaymentValidationDialog payment={validating} saleNumber={saleLabel(sale.number)} customerName={`${sale.customer.firstName} ${sale.customer.lastName}`} close={closeValidation} validated={async () => { await load(); closeValidation(); }} />}
    {correcting && <PaymentAmountDialog payment={correcting} balance={data.balance} projectedBalance={data.projectedBalance} close={closeCorrection} updated={async () => { await load(); closeCorrection(); }} />}
    {editingOrder && <SaleOrderDialog sale={{ id: sale.id, number: sale.number, version: sale.version }} close={closeOrder} updated={async () => { await load(); closeOrder(); }} />}
    {deleting && <DeleteDialog endpoint={deleting.endpoint} close={() => setDeleting(null)} deleted={async () => { if (deleting.sale) { router.replace("/ventas"); router.refresh(); } else { setDeleting(null); await load(); } }} />}
  </>;
}
