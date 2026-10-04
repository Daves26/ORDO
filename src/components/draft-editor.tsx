"use client";
import { useEffect, useState, useRef } from "react";
import { money } from "@/lib/format";
import { DateField } from "@/components/date-field";
import { addDaysIsoDate, fromIsoDate, toIsoDate } from "@/lib/local-date";
import { ServiceMultiSelect } from "@/components/service-multi-select";
import { isSaleServiceType, type SaleServiceType } from "@/lib/service-types";

type SaleDraft = { version: number; destination: string; notes: string | null; services: { id: string; type: string }[]; startsAt: string | null; endsAt: string | null; customerDueAt: string | null; total: string };
export function DraftEditor({ id, sale, saved }: { id: string; sale: SaleDraft; saved: () => Promise<void> }) {
  const [form, setForm] = useState({ destination: sale.destination, notes: sale.notes ?? "", startsAt: fromIsoDate(sale.startsAt), endsAt: fromIsoDate(sale.endsAt), customerDueAt: fromIsoDate(sale.customerDueAt), total: String(Number(sale.total)) });
  const [selectedServices, setSelectedServices] = useState<SaleServiceType[]>(sale.services.map((service) => service.type).filter(isSaleServiceType));
  const [calendarField, setCalendarField] = useState<"startsAt" | "endsAt" | null>(null);
  const [servicesChanged, setServicesChanged] = useState(false);
  const [version, setVersion] = useState(sale.version); const [dirty, setDirty] = useState(false); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  const latest = useRef(form); latest.current = form;
  const inFlight = useRef(false);
  const revision = useRef(0);
  async function save() {
    if (!dirty || inFlight.current) return;
    const input = latest.current;
    if ([input.startsAt, input.endsAt, input.customerDueAt].some((value) => value && !toIsoDate(value))) { setMessage("Corrige las fechas: usa DD/MM/AAAA y comprueba que el día exista."); return; }
    const startsAt = input.startsAt ? toIsoDate(input.startsAt)! : "";
    const endsAt = input.endsAt ? toIsoDate(input.endsAt)! : "";
    const customerDueAt = input.customerDueAt ? toIsoDate(input.customerDueAt)! : "";
    if (startsAt && endsAt && endsAt <= startsAt) { setMessage("El regreso debe ser posterior a la salida."); return; }
    if (Number(input.total) < 1) { setMessage("El valor debe ser positivo."); return; }
    if (servicesChanged && !selectedServices.length) { setMessage("Selecciona al menos un servicio incluido."); return; }
    inFlight.current = true; setSaving(true); setMessage("");
    const savedRevision = revision.current;
    try {
      const res = await fetch(`/api/sales/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, startsAt, endsAt, customerDueAt, total: Number(input.total), services: servicesChanged ? selectedServices : undefined, version }) });
      const result = await res.json(); if (!res.ok) { setMessage(result.error); return; }
      setVersion(result.version); setDirty(revision.current !== savedRevision); setMessage("Guardado automáticamente."); await saved();
    } catch { setMessage("No se guardó. Reintenta antes de salir."); }
    finally { inFlight.current = false; setSaving(false); }
  }
  useEffect(() => { if (!dirty || saving) return; const timer = setTimeout(() => void save(), 1300); return () => clearTimeout(timer); /* intentionally keyed to edits */ }, [form, selectedServices, servicesChanged, dirty, saving]);
  useEffect(() => { function key(e: KeyboardEvent) { if (e.ctrlKey && e.key.toLowerCase() === "s") { e.preventDefault(); void save(); } } document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); });
  function change(key: keyof typeof form, value: string) { setForm((old) => ({ ...old, [key]: value })); revision.current++; setDirty(true); setMessage("Cambios pendientes…"); }
  return <section className="card"><div className="page-heading"><div><h2>Completar borrador</h2><span role="status" className="muted small">{saving ? "Guardando…" : message}</span></div><button className="btn" type="button" onClick={() => void save()} disabled={!dirty || saving}>Guardar borrador</button></div><div className="form-grid"><div className="field"><label htmlFor="edit-destination">Destino</label><input id="edit-destination" value={form.destination} onChange={(e) => change("destination", e.target.value)} /></div><div className="field"><label htmlFor="edit-total">Valor · COP</label><input id="edit-total" inputMode="numeric" value={form.total ? money(form.total) : ""} onChange={(e) => change("total", e.target.value.replace(/\D/g, ""))} /></div><ServiceMultiSelect selected={selectedServices} onChange={(next) => { setSelectedServices(next); setServicesChanged(true); revision.current++; setDirty(true); setMessage("Cambios pendientes…"); }} /><div className="field full"><label htmlFor="edit-notes">Observaciones de la orden de servicio{selectedServices.includes("OTRO") ? " (pendiente si eliges Otro)" : ""}</label><textarea id="edit-notes" rows={3} maxLength={2000} value={form.notes} onChange={(event) => change("notes", event.target.value)} placeholder="Aclara los servicios incluidos; especifica aquí el servicio Otro." /></div><DateField id="edit-start" label="Salida" value={form.startsAt} onChange={(value) => change("startsAt", value)} calendar calendarOpen={calendarField === "startsAt"} onCalendarOpenChange={(open) => setCalendarField(open ? "startsAt" : null)} onCalendarSelect={(iso) => { if (form.endsAt && toIsoDate(form.endsAt) && toIsoDate(form.endsAt)! <= iso) change("endsAt", ""); setCalendarField("endsAt"); }} /><DateField id="edit-end" label="Regreso" value={form.endsAt} onChange={(value) => change("endsAt", value)} calendar calendarOpen={calendarField === "endsAt"} onCalendarOpenChange={(open) => setCalendarField(open ? "endsAt" : null)} minIsoDate={toIsoDate(form.startsAt) ? addDaysIsoDate(toIsoDate(form.startsAt)!, 1) : undefined} /><DateField id="edit-due" label="Pago máximo cliente" value={form.customerDueAt} onChange={(value) => change("customerDueAt", value)} /></div><p className="muted small">Se guarda tras una pausa al escribir. Ctrl + S guarda ahora. Para registrar la venta, completa las fechas y guarda primero.</p></section>;
}
