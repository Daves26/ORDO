"use client";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { CustomerTextInput } from "@/components/customer-text-input";
import { formatCustomerText } from "@/lib/customer-format";
import type { CustomerOption } from "@/components/customer-picker";

type Props = {
  onCreated: (customer: CustomerOption) => void;
  onExisting?: (customer: CustomerOption) => void;
  initialQuery?: string;
};

export function CustomerForm({ onCreated, onExisting, initialQuery = "" }: Props) {
  const [error, setError] = useState("");
  const [similar, setSimilar] = useState<CustomerOption[]>([]);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const words = initialQuery.trim().split(/\s+/);
  const firstName = words.length <= 2 ? words[0] ?? "" : "";
  const lastName = words.length === 2 ? words[1] : "";

  async function selectExisting(id: string) {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/customers/${id}`);
      if (!response.ok) throw new Error();
      onExisting?.((await response.json()).customer);
    } catch { setError("No se pudo recuperar esta ficha. Vuelve a buscar al cliente."); }
    finally { setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = event.currentTarget;
    try {
      const response = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(confirmed ? { "x-confirm-similar": "true" } : {}) },
        body: JSON.stringify(Object.fromEntries(new FormData(form))),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "Revisa los datos del cliente.");
        setSimilar(result.details?.similar ?? []);
        setExistingId(result.details?.existingId ?? null);
        return;
      }
      setSimilar([]); setExistingId(null); setConfirmed(false);
      onCreated(result.customer);
      form.reset();
    } catch { setError("No fue posible conectar con el servidor."); }
    finally { setBusy(false); }
  }

  return <form onSubmit={submit} onChange={(event) => {
    if (!(event.target instanceof HTMLInputElement && event.target.name === "confirmSimilar")) {
      setConfirmed(false); setSimilar([]); setExistingId(null); setError("");
    }
  }}>
    <div className="form-grid">
      <div className="field"><label htmlFor="new-customer-first">Nombres *</label><CustomerTextInput id="new-customer-first" name="firstName" defaultValue={formatName(firstName)} required minLength={2} autoFocus /></div>
      <div className="field"><label htmlFor="new-customer-last">Apellidos *</label><CustomerTextInput id="new-customer-last" name="lastName" defaultValue={formatName(lastName)} required minLength={2} /></div>
      <div className="field"><label htmlFor="new-customer-document-type">Tipo de documento</label><select id="new-customer-document-type" name="documentType" defaultValue=""><option value="">Sin documento aún</option><option value="CC">Cédula</option><option value="CE">Cédula de extranjería</option><option value="PASAPORTE">Pasaporte</option><option value="NIT">NIT</option></select></div>
      <div className="field"><label htmlFor="new-customer-document-number">Número de documento</label><input id="new-customer-document-number" name="documentNumber" /></div>
      <div className="field"><label htmlFor="new-customer-phone">Teléfono *</label><input id="new-customer-phone" name="phone" inputMode="tel" required minLength={7} /></div>
      <div className="field"><label htmlFor="new-customer-email">Correo</label><input id="new-customer-email" name="email" type="email" /></div>
    </div>
    {error && <p role="alert" className="notice warning" style={{ marginTop: 16 }}>{error}</p>}
    {existingId && <div style={{ marginTop: 12 }}>{onExisting ? <button type="button" className="btn" onClick={() => void selectExisting(existingId)} disabled={busy}>Seleccionar ficha existente</button> : <Link className="btn" href={`/clientes/${existingId}`}>Abrir ficha existente</Link>}</div>}
    {similar.length > 0 && <div style={{ marginTop: 12 }}><strong>Posibles coincidencias:</strong>{similar.map((candidate) => onExisting ? <button type="button" className="suggestion" key={candidate.id} onClick={() => void selectExisting(candidate.id)} disabled={busy}>{candidate.firstName} {candidate.lastName} · {candidate.phone} → Seleccionar</button> : <Link className="list-row" href={`/clientes/${candidate.id}`} key={candidate.id}>{candidate.firstName} {candidate.lastName} · {candidate.phone} →</Link>)}<label style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 12 }}><input type="checkbox" name="confirmSimilar" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /> Revisé las fichas: se trata de otra persona.</label></div>}
    <div className="form-actions"><button className="btn btn-primary" disabled={busy || (similar.length > 0 && !confirmed)}>{busy ? "Guardando…" : "Crear cliente"}</button></div>
  </form>;
}

function formatName(value: string) {
  return value ? formatCustomerText(value) : "";
}
