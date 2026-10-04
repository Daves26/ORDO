"use client";
import { useRef, useState, type FormEvent } from "react";
import { DeleteDialog } from "@/components/delete-dialog";
import { date } from "@/lib/format";
import { LOCATOR_SOURCES, locatorSourceLabel, type LocatorSourceCode } from "@/lib/locator-options";
import { serviceLabel } from "@/lib/service-types";

export type LocatorItem = {
  id: string; code: string; source: LocatorSourceCode; issuerName: string | null; serviceId: string | null;
  notes: string | null; createdById: string; createdBy: { name: string };
  createdAt: string; version: number; service: { name: string; type: string } | null;
};

type Fields = { code: string; source: LocatorSourceCode; issuerName: string; serviceId: string; notes: string };
const empty: Fields = { code: "", source: "MAYORISTA", issuerName: "", serviceId: "", notes: "" };

export function SaleLocators({ saleId, services, locators, actorId, canEditAll, canDelete, saved }: {
  saleId: string; services: { id: string; type: string; name: string }[];
  locators: LocatorItem[]; actorId: string; canEditAll: boolean; canDelete: boolean; saved: () => Promise<void>;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [fields, setFields] = useState<Fields>(empty);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const sourceRef = useRef<HTMLSelectElement>(null);
  const editor = locators.find(({ id }) => id === editingId);

  function startCreate() {
    setFields(empty); setEditingId(null); setCreating(true); setError("");
    requestAnimationFrame(() => sourceRef.current?.focus());
  }
  function startEdit(locator: LocatorItem) {
    setFields({ code: locator.code, source: locator.source, issuerName: locator.issuerName ?? "", serviceId: locator.serviceId ?? "", notes: locator.notes ?? "" });
    setEditingId(locator.id); setCreating(false); setError("");
    requestAnimationFrame(() => sourceRef.current?.focus());
  }
  function cancel() { setCreating(false); setEditingId(null); setError(""); }
  function change(key: keyof Fields, value: string) { setFields((previous) => ({ ...previous, [key]: value })); setError(""); }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const url = editor ? `/api/sales/${saleId}/locators/${editor.id}` : `/api/sales/${saleId}/locators`;
    try {
      const response = await fetch(url, { method: editor ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
        ...fields, serviceId: fields.serviceId || null, issuerName: fields.issuerName.trim(), notes: fields.notes.trim(),
        ...(editor ? { version: editor.version } : { requestId }),
      }) });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "No se pudo guardar el localizador."); return; }
      if (!editor) setRequestId(crypto.randomUUID());
      cancel(); await saved();
    } catch { setError("No se pudo confirmar el guardado. Revisa el expediente antes de reintentar."); }
    finally { setBusy(false); }
  }

  return <section className="card" style={{ marginTop: 20 }} aria-labelledby="locators-heading">
    <div className="page-heading" style={{ marginBottom: 10 }}><div><span className="eyebrow">Operación</span><h2 id="locators-heading" style={{ marginBottom: 0 }}>Localizadores</h2></div>{!creating && !editingId && <button className="btn btn-primary" type="button" onClick={startCreate}>Añadir localizador</button>}</div>
    {locators.length ? locators.map((locator) => <div className="list-row" key={locator.id}>
      <div style={{ minWidth: 0 }}><strong style={{ fontFamily: "ui-monospace, monospace", overflowWrap: "anywhere", fontSize: 16 }}>{locator.code}</strong><div className="muted small">{locatorSourceLabel(locator.source)}{locator.issuerName ? ` · ${locator.issuerName}` : ""}{locator.service ? ` · ${serviceLabel(locator.service.type)}` : " · Toda la OS"}</div><div className="muted small">Registrado por {locator.createdBy.name} · {date(locator.createdAt)}</div>{locator.notes && <div className="small" style={{ whiteSpace: "pre-wrap" }}>{locator.notes}</div>}</div>
      {(canEditAll || locator.createdById === actorId || canDelete) && <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {(canEditAll || locator.createdById === actorId) && <button className="btn" type="button" onClick={() => startEdit(locator)}>Corregir</button>}
        {canDelete && <button className="btn btn-danger" type="button" onClick={() => setDeletingId(locator.id)}>Eliminar</button>}
      </div>}
    </div>) : <p className="muted">Todavía no hay códigos registrados para esta orden.</p>}
    {(creating || editor) && <form onSubmit={submit} style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginTop: 20 }}>
      <h2>{editor ? "Corregir localizador" : "Nuevo localizador"}</h2>
      <div className="form-grid">
        <div className="field"><label htmlFor="locator-source">Origen *</label><select ref={sourceRef} id="locator-source" value={fields.source} onChange={(event) => change("source", event.target.value)}>{LOCATOR_SOURCES.map((item) => <option key={item.code} value={item.code}>{item.label}</option>)}</select></div>
        <div className="field"><label htmlFor="locator-issuer">Emisor</label><input id="locator-issuer" value={fields.issuerName} onChange={(event) => change("issuerName", event.target.value)} maxLength={120} placeholder="Ej. nombre de la mayorista o aerolínea" /></div>
        <div className="field"><label htmlFor="locator-code">Código o número *</label><input id="locator-code" value={fields.code} onChange={(event) => change("code", event.target.value)} required maxLength={120} autoCapitalize="none" spellCheck={false} placeholder="Escribe el código tal como aparece" /></div>
        <div className="field"><label htmlFor="locator-service">Servicio relacionado</label><select id="locator-service" value={fields.serviceId} onChange={(event) => change("serviceId", event.target.value)}><option value="">Toda la OS / sin servicio específico</option>{services.map((service) => <option key={service.id} value={service.id}>{serviceLabel(service.type)}</option>)}</select></div>
        <div className="field full"><label htmlFor="locator-notes">Observación del localizador</label><textarea id="locator-notes" value={fields.notes} onChange={(event) => change("notes", event.target.value)} rows={2} maxLength={500} placeholder="Información operativa adicional, si hace falta" /><span className="field-hint">Si eliges Otro, indica el emisor o describe aquí el origen.</span></div>
      </div>
      {error && <p role="alert" className="notice error" style={{ marginTop: 12 }}>{error}</p>}
      <div className="form-actions"><button type="button" className="btn" disabled={busy} onClick={cancel}>Cancelar</button><button type="submit" className="btn btn-primary" disabled={busy || !fields.code.trim() || (fields.source === "OTRO" && !fields.issuerName.trim() && !fields.notes.trim())}>{busy ? "Guardando…" : "Guardar localizador"}</button></div>
    </form>}
    {deletingId && <DeleteDialog endpoint={`/api/sales/${saleId}/locators/${deletingId}/delete`} close={() => setDeletingId(null)} deleted={async () => { setDeletingId(null); await saved(); }} />}
  </section>;
}
