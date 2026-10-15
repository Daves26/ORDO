"use client";
import { useEffect, useState, type FormEvent } from "react";
import { DateField } from "@/components/date-field";
import { fromIsoDate, toIsoDate } from "@/lib/local-date";

type Person = { id: string; firstName: string; lastName: string; documentType: string | null; documentNumber: string | null; birthDate: string | null; passportNumber: string | null; passportExpiry: string | null };
type Order = { version: number; passengers: { passenger: Person }[] };
const blankPassenger = (): Person => ({ id: "", firstName: "", lastName: "", documentType: null, documentNumber: null, birthDate: "", passportNumber: null, passportExpiry: "" });
const dateError = "Revisa las fechas: usa DD/MM/AAAA y comprueba que el día exista.";
const safeError = (result: { error?: string; details?: { fieldErrors?: Record<string, string[]> } }) => result.details?.fieldErrors ? Object.values(result.details.fieldErrors).flat().join(" · ") || result.error : result.error;

export function SaleOrderDetails({ saleId, initial, canEditOperational, saved }: {
  saleId: string; initial: Order; canEditOperational: boolean; saved: () => Promise<void>;
}) {
  const [sale, setSale] = useState<Order>(initial);
  const [error, setError] = useState("");
  useEffect(() => { if (initial.version > sale.version) setSale(initial); }, [initial, sale.version]);
  async function save(passengers: object[]) {
    setError("");
    try {
      const response = await fetch(`/api/sales/${saleId}/order-details`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ section: "passengers", version: sale.version, passengers }) });
      const result = await response.json();
      if (!response.ok) { setError(safeError(result) ?? "No se pudieron guardar los pasajeros."); return false; }
      await saved();
      return true;
    } catch { setError("No se pudo confirmar el guardado. Recarga el expediente antes de reintentar."); return false; }
  }
  return <section className="card" style={{ marginTop: 20 }} aria-labelledby="passengers-title">
    <h2 id="passengers-title">Datos de los pasajeros</h2>
    {error && <p className="notice error" role="alert">{error}</p>}
    <PassengerSection key={sale.version} passengers={sale.passengers.map(({ passenger }) => passenger)} editable={canEditOperational} save={save} />
  </section>;
}

function PassengerSection({ passengers, editable, save }: { passengers: Person[]; editable: boolean; save: (items: object[]) => Promise<boolean> }) {
  const [items, setItems] = useState<Person[]>(passengers.map((person) => ({ ...person, birthDate: fromIsoDate(person.birthDate), passportExpiry: fromIsoDate(person.passportExpiry) })));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) { event.preventDefault(); if (!items.flatMap((item) => [item.birthDate ?? "", item.passportExpiry ?? ""]).every((value) => !value || !!toIsoDate(value))) { setError(dateError); return; } setError(""); setBusy(true); await save(items.map((item) => ({ ...item, id: item.id || undefined, birthDate: item.birthDate ? toIsoDate(item.birthDate) : "", passportExpiry: item.passportExpiry ? toIsoDate(item.passportExpiry) : "" }))); setBusy(false); }
  return <form onSubmit={submit}>
    <p className="muted small">Un pasajero con el mismo tipo y número de documento se reutiliza entre órdenes. El comprador no se agrega automáticamente como pasajero.</p>
    {items.map((item, index) => <fieldset key={item.id || `nuevo-${index}`} disabled={!editable || busy} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginTop: 12 }}>
      <legend>Pasajero {index + 1}</legend><div className="form-grid">
        {([ ["firstName", "Nombres *"], ["lastName", "Apellidos *"], ["documentType", "Tipo de identificación"], ["documentNumber", "Identificación"], ["passportNumber", "N.º de pasaporte"] ] as const).map(([key, label]) => <div className="field" key={key}><label htmlFor={`pass-${key}-${index}`}>{label}</label><input id={`pass-${key}-${index}`} value={item[key] ?? ""} required={key === "firstName" || key === "lastName"} maxLength={100} onChange={(event) => setItems(items.map((entry, i) => i === index ? { ...entry, [key]: event.target.value } : entry))} /></div>)}
        {([ ["birthDate", "Fecha de nacimiento"], ["passportExpiry", "Vencimiento de pasaporte"] ] as const).map(([key, label]) => <DateField key={key} id={`pass-${key}-${index}`} label={label} value={item[key] ?? ""} onChange={(value) => setItems(items.map((entry, i) => i === index ? { ...entry, [key]: value } : entry))} />)}
      </div>{editable && <button type="button" className="btn btn-danger" onClick={() => setItems(items.filter((_, i) => i !== index))}>Quitar de la OS</button>}
    </fieldset>)}
    {!items.length && <p className="muted">Todavía no se registraron pasajeros.</p>}
    {error && <p role="alert" className="field-error">{error}</p>}
    {editable && <div className="form-actions"><button type="button" className="btn" onClick={() => setItems([...items, blankPassenger()])}>Añadir pasajero</button><button className="btn btn-primary" disabled={busy}>{busy ? "Guardando…" : "Guardar pasajeros"}</button></div>}
  </form>;
}
