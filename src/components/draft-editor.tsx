"use client";
import { useEffect, useState, useRef } from "react";
import { money } from "@/lib/format";
import { DateField } from "@/components/date-field";
import { fromIsoDate, toIsoDate } from "@/lib/local-date";

type SaleDraft = { version: number; destination: string; startsAt: string | null; endsAt: string | null; customerDueAt: string | null; total: string };
export function DraftEditor({ id, sale, saved }: { id: string; sale: SaleDraft; saved: () => Promise<void> }) {
  const [form, setForm] = useState({ destination: sale.destination, startsAt: fromIsoDate(sale.startsAt), endsAt: fromIsoDate(sale.endsAt), customerDueAt: fromIsoDate(sale.customerDueAt), total: String(Number(sale.total)) });
  const [version, setVersion] = useState(sale.version); const [dirty, setDirty] = useState(false); const [saving, setSaving] = useState(false); const [message, setMessage] = useState("");
  const latest = useRef(form); latest.current = form;
  const inFlight = useRef(false);
  async function save() {
    if (!dirty || inFlight.current) return;
    const input = latest.current;
    if ([input.startsAt, input.endsAt, input.customerDueAt].some((value) => value && !toIsoDate(value))) { setMessage("Corrige las fechas: usa DD/MM/AAAA y comprueba que el día exista."); return; }
    const startsAt = input.startsAt ? toIsoDate(input.startsAt)! : "";
    const endsAt = input.endsAt ? toIsoDate(input.endsAt)! : "";
    const customerDueAt = input.customerDueAt ? toIsoDate(input.customerDueAt)! : "";
    if (startsAt && endsAt && endsAt < startsAt) { setMessage("El regreso no puede ser anterior a la salida."); return; }
    if (Number(input.total) < 1) { setMessage("El valor debe ser positivo."); return; }
    inFlight.current = true; setSaving(true); setMessage("");
    try {
      const res = await fetch(`/api/sales/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, startsAt, endsAt, customerDueAt, total: Number(input.total), version }) });
      const result = await res.json(); if (!res.ok) { setMessage(result.error); return; }
      setVersion(result.version); setDirty(latest.current !== input); setMessage("Guardado automáticamente."); await saved();
    } catch { setMessage("No se guardó. Reintenta antes de salir."); }
    finally { inFlight.current = false; setSaving(false); }
  }
  useEffect(() => { if (!dirty || saving) return; const timer = setTimeout(() => void save(), 1300); return () => clearTimeout(timer); /* intentionally keyed to edits */ }, [form, dirty, saving]);
  useEffect(() => { function key(e: KeyboardEvent) { if (e.ctrlKey && e.key.toLowerCase() === "s") { e.preventDefault(); void save(); } } document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key); });
  function change(key: keyof typeof form, value: string) { setForm((old) => ({ ...old, [key]: value })); setDirty(true); setMessage("Cambios pendientes…"); }
  return <section className="card"><div className="page-heading"><div><h2>Completar borrador</h2><span role="status" className="muted small">{saving ? "Guardando…" : message}</span></div><button className="btn" type="button" onClick={() => void save()} disabled={!dirty || saving}>Guardar borrador</button></div><div className="form-grid"><div className="field"><label htmlFor="edit-destination">Destino</label><input id="edit-destination" value={form.destination} onChange={(e) => change("destination", e.target.value)} /></div><div className="field"><label htmlFor="edit-total">Valor · COP</label><input id="edit-total" inputMode="numeric" value={form.total ? money(form.total) : ""} onChange={(e) => change("total", e.target.value.replace(/\D/g, ""))} /></div><DateField id="edit-start" label="Salida" value={form.startsAt} onChange={(value) => change("startsAt", value)} /><DateField id="edit-end" label="Regreso" value={form.endsAt} onChange={(value) => change("endsAt", value)} /><DateField id="edit-due" label="Pago máximo cliente" value={form.customerDueAt} onChange={(value) => change("customerDueAt", value)} /></div><p className="muted small">Se guarda tras una pausa al escribir. Ctrl + S guarda ahora. Para registrar la venta, completa las fechas y guarda primero.</p></section>;
}
