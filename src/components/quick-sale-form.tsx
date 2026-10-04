"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Info, ShieldCheck } from "lucide-react";
import { CustomerPicker, type CustomerOption } from "@/components/customer-picker";
import { DateField } from "@/components/date-field";
import { money } from "@/lib/format";
import { addDaysIsoDate, toIsoDate } from "@/lib/local-date";
import { ServiceMultiSelect } from "@/components/service-multi-select";
import type { SaleServiceType } from "@/lib/service-types";

type DateKey = "startsAt" | "endsAt" | "customerDueAt";

export function QuickSaleForm({ supportAdvisors }: { supportAdvisors?: { id: string; name: string }[] }) {
  const router = useRouter();
  const orderRef = useRef<HTMLInputElement>(null);
  const destinationRef = useRef<HTMLInputElement>(null);
  const notesRef = useRef<HTMLTextAreaElement>(null);
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [orderNumber, setOrderNumber] = useState("");
  const [availability, setAvailability] = useState<{ number: string; state: "checking" | "available" | "taken" | "error" } | null>(null);
  const [dates, setDates] = useState<Record<DateKey, string>>({ startsAt: "", endsAt: "", customerDueAt: "" });
  const [calendarField, setCalendarField] = useState<"startsAt" | "endsAt" | null>(null);
  const [total, setTotal] = useState("");
  const [payment, setPayment] = useState("");
  const [services, setServices] = useState<SaleServiceType[]>([]);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [requestId] = useState(() => crypto.randomUUID());
  const amount = Number(total || 0), deposit = Number(payment || 0);
  const orderTaken = availability?.number === orderNumber && availability.state === "taken";

  useEffect(() => {
    if (orderNumber.length !== 4) { setAvailability(null); return; }
    const controller = new AbortController();
    setAvailability({ number: orderNumber, state: "checking" });
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/sales/os/availability?number=${orderNumber}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        const result = await response.json();
        if (!controller.signal.aborted) setAvailability({ number: orderNumber, state: result.available ? "available" : "taken" });
      } catch { if (!controller.signal.aborted) setAvailability({ number: orderNumber, state: "error" }); }
    }, 200);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [orderNumber]);

  function selectCustomer(option: CustomerOption | null) {
    setCustomer(option); setError("");
    if (option) requestAnimationFrame(() => orderRef.current?.focus());
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    if (!customer) { setError("Selecciona o crea el cliente antes de registrar la venta."); return; }
    if (!/^[0-9]{4}$/.test(orderNumber)) { setError("Ingresa los cuatro dígitos reales de la orden de servicio."); orderRef.current?.focus(); return; }
    if (orderTaken) { setError("Esta OS ya está asignada a otra venta."); return; }
    if (!services.length) { setError("Selecciona al menos un servicio para la orden."); return; }
    if (services.includes("OTRO") && !notes.trim()) { setError("Describe el servicio Otro en las observaciones de la orden."); notesRef.current?.focus(); return; }
    if (!amount || deposit > amount) { setError("Indica un valor positivo y un abono que no supere el total."); return; }
    const invalidDate = (Object.entries(dates) as [DateKey, string][]).find(([, value]) => value && !toIsoDate(value));
    if (invalidDate) { setError("Revisa las fechas: usa DD/MM/AAAA y comprueba que el día exista."); return; }
    const start = dates.startsAt ? toIsoDate(dates.startsAt)! : "";
    const end = dates.endsAt ? toIsoDate(dates.endsAt)! : "";
    if (start && end && end <= start) { setError("El regreso debe ser posterior a la salida."); return; }
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/sales", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        customerId: customer.id, advisorId: form.get("advisorId") || undefined, orderNumber, destination: form.get("destination"), services, notes,
        startsAt: start, endsAt: end, customerDueAt: dates.customerDueAt ? toIsoDate(dates.customerDueAt) : "",
        total: amount, initialPayment: deposit, paymentMethod: form.get("paymentMethod") || undefined, requestId,
      }) });
      const result = await response.json();
      if (!response.ok) { setError(result.details?.fieldErrors ? Object.values(result.details.fieldErrors).flat().join(" · ") : result.error); return; }
      router.push(`/ventas/${result.id}`); router.refresh();
    } catch { setError("No fue posible conectar. Reintenta: la solicitud conservará el mismo identificador y no duplicará la venta."); }
    finally { setBusy(false); }
  }

  return <div className="grid split"><section className="card">
    <CustomerPicker selected={customer} onSelect={selectCustomer} inlineCreate />
    {!customer && <p className="notice" style={{ marginTop: 18 }}>Selecciona una ficha existente o crea al cliente aquí para habilitar los datos del viaje.</p>}
    <form onSubmit={submit} onKeyDown={(event) => { if (event.ctrlKey && event.key === "Enter" && customer && !busy) { event.preventDefault(); event.currentTarget.requestSubmit(); } }}>
      <fieldset className="form-locked" disabled={!customer || busy} style={{ marginTop: 20 }}>
        <div className="form-grid">
          {supportAdvisors && <div className="field full"><label htmlFor="advisorId">Asesor responsable *</label><select id="advisorId" name="advisorId" required>{supportAdvisors.map((advisor) => <option key={advisor.id} value={advisor.id}>{advisor.name}</option>)}</select><span className="field-hint">El expediente queda asignado a esta persona; tu intervención como administrador queda registrada.</span></div>}
          <div className="field full"><label htmlFor="orderNumber">Número de orden de servicio *</label><input ref={orderRef} id="orderNumber" name="orderNumber" type="text" inputMode="numeric" autoComplete="off" maxLength={4} pattern="[0-9]{4}" required placeholder="Ej. 0123" aria-invalid={orderTaken || undefined} aria-describedby="order-number-hint" value={orderNumber} onChange={(event) => { setOrderNumber(event.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} /><span id="order-number-hint" className={orderTaken ? "field-error" : "field-hint"} role="status">{orderTaken ? "Esta OS ya está asignada a otra venta." : availability?.number === orderNumber && availability.state === "checking" ? "Comprobando OS…" : availability?.number === orderNumber && availability.state === "available" ? "OS disponible." : "Escribe únicamente los cuatro dígitos de la orden real; se verá como OS 0123."}</span></div>
          <div className="field"><label htmlFor="destination">Destino *</label><input ref={destinationRef} id="destination" name="destination" placeholder="Ej. Cancún" required minLength={2} maxLength={150} /></div>
          <ServiceMultiSelect selected={services} onChange={setServices} disabled={!customer || busy} />
          <div className="field full"><label htmlFor="sale-notes">Observaciones de la orden de servicio{services.includes("OTRO") ? " *" : ""}</label><textarea ref={notesRef} id="sale-notes" name="notes" rows={3} maxLength={2000} required={services.includes("OTRO")} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Aclara detalles de los servicios incluidos; si seleccionaste Otro, indica qué servicio es." /><span className="field-hint">{services.includes("OTRO") ? "Especifica aquí qué servicio corresponde a Otro." : "Opcional: agrega detalles útiles para la gestión del viaje."}</span></div>
          <DateField id="startsAt" label="Salida" value={dates.startsAt} onChange={(value) => setDates((previous) => ({ ...previous, startsAt: value }))} calendar calendarOpen={calendarField === "startsAt"} onCalendarOpenChange={(open) => setCalendarField(open ? "startsAt" : null)} onCalendarSelect={(iso) => {
            setDates((previous) => ({ ...previous, endsAt: previous.endsAt && toIsoDate(previous.endsAt) && toIsoDate(previous.endsAt)! <= iso ? "" : previous.endsAt }));
            setCalendarField("endsAt");
          }} />
          <DateField id="endsAt" label="Regreso" value={dates.endsAt} onChange={(value) => setDates((previous) => ({ ...previous, endsAt: value }))} calendar calendarOpen={calendarField === "endsAt"} onCalendarOpenChange={(open) => setCalendarField(open ? "endsAt" : null)} minIsoDate={toIsoDate(dates.startsAt) ? addDaysIsoDate(toIsoDate(dates.startsAt)!, 1) : undefined} />
          <div className="field"><label htmlFor="total">Valor total · COP *</label><input id="total" name="total" inputMode="numeric" placeholder="$ 0" required value={total ? money(total) : ""} onChange={(event) => setTotal(event.target.value.replace(/\D/g, ""))} /><span className="field-hint">Se guarda en pesos colombianos.</span></div>
          <DateField id="customerDueAt" label="Pago máximo del cliente" value={dates.customerDueAt} onChange={(value) => setDates((previous) => ({ ...previous, customerDueAt: value }))} />
          <div className="full" style={{ borderTop: "1px solid var(--border)", paddingTop: 18, marginTop: 4 }}><strong>¿El cliente pagó ahora?</strong><p className="muted small" style={{ margin: "3px 0 0" }}>Regístralo como reportado; contabilidad lo validará.</p></div>
          <div className="field"><label htmlFor="initialPayment">Abono inicial · COP</label><input id="initialPayment" name="initialPayment" inputMode="numeric" placeholder="$ 0" value={payment ? money(payment) : ""} onChange={(event) => setPayment(event.target.value.replace(/\D/g, ""))} /></div>
          {deposit > 0 && <div className="field"><label htmlFor="paymentMethod">Medio de pago *</label><select id="paymentMethod" name="paymentMethod" required defaultValue="TRANSFERENCIA"><option value="TRANSFERENCIA">Transferencia</option><option value="EFECTIVO">Efectivo</option><option value="TARJETA">Tarjeta</option><option value="CONSIGNACION">Consignación</option><option value="OTRO">Otro</option></select></div>}
        </div>
      </fieldset>
      {error && <p className="notice error" role="alert" style={{ marginTop: 16 }}>{error}</p>}
      <div className="form-actions"><button className="btn btn-primary" disabled={busy || !customer || orderNumber.length !== 4 || orderTaken || !services.length || (services.includes("OTRO") && !notes.trim())}>{busy ? "Creando expediente…" : "Crear venta"}<ArrowRight size={17} aria-hidden="true" /></button></div><p className="muted small" style={{ textAlign: "right" }}>Ctrl + Enter para crear</p>
    </form>
  </section>
  <aside><div className="card" style={{ background: "linear-gradient(135deg,#eef2ff,#faf5ff)" }}><ShieldCheck color="#4f46e5" size={28} aria-hidden="true" /><h2 style={{ marginTop: 18 }}>Primero el cliente. Luego la venta.</h2><p className="muted">Busca su ficha o créala sin salir de esta pantalla. El expediente se crea como borrador y podrás añadir pasajeros, documentos y proveedores después.</p></div><div className="card" style={{ marginTop: 20 }}><Info color="#4f46e5" size={20} aria-hidden="true" /><h2 style={{ marginTop: 14 }}>Resumen inmediato</h2><div className="list-row"><span className="muted">Precio acordado</span><strong>{money(amount)}</strong></div><div className="list-row"><span className="muted">Abono por validar</span><strong>{money(deposit)}</strong></div><div className="list-row"><span className="muted">Saldo contable inicial</span><strong>{money(amount)}</strong></div>{deposit > 0 && <p className="muted small">Proyección después de validar: {money(Math.max(0, amount - deposit))}.</p>}</div></aside></div>;
}
