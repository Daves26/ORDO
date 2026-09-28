"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CustomerTextInput } from "@/components/customer-text-input";

type Initial = { version: number; firstName: string; lastName: string; phone: string; email: string; documentType: string; documentNumber: string; city: string; address: string };
export function CustomerEditor({ id, initial }: { id: string; initial: Initial }) {
  const router = useRouter(); const [open, setOpen] = useState(false); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = Object.fromEntries(new FormData(event.currentTarget));
    const changed = Object.fromEntries(Object.entries(data).filter(([key, value]) => value !== initial[key as keyof Initial]));
    if (!Object.keys(changed).length) { setBusy(false); setOpen(false); return; }
    try { const res = await fetch(`/api/customers/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...changed, version: initial.version }) }); const result = await res.json(); if (!res.ok) { setError(result.error); return; } setOpen(false); router.refresh(); }
    catch { setError("No se pudo guardar. Reintenta."); } finally { setBusy(false); }
  }
  return <section className="card" style={{ marginTop: 20 }}><div className="page-heading" style={{ marginBottom: open ? 16 : 0 }}><div><h2 style={{ marginBottom: 0 }}>Actualizar ficha</h2><span className="muted small">Los cambios quedarán en el historial.</span></div><button className="btn" onClick={() => setOpen(!open)}>{open ? "Cerrar" : "Editar datos"}</button></div>{open && <form onSubmit={save}><div className="form-grid">{([{ key: "firstName", label: "Nombres *", required: true }, { key: "lastName", label: "Apellidos *", required: true }, { key: "documentType", label: "Tipo de documento" }, { key: "documentNumber", label: "Número de documento" }, { key: "phone", label: "Teléfono *", required: true }, { key: "email", label: "Correo", type: "email" }, { key: "city", label: "Ciudad" }, { key: "address", label: "Dirección" }] as const).map((field) => <div className="field" key={field.key}><label htmlFor={`customer-${field.key}`}>{field.label}</label>{["firstName", "lastName", "city", "address"].includes(field.key) ? <CustomerTextInput id={`customer-${field.key}`} name={field.key} defaultValue={initial[field.key]} formatKind={field.key === "city" || field.key === "address" ? "place" : "person"} required={"required" in field && field.required} /> : <input id={`customer-${field.key}`} name={field.key} defaultValue={initial[field.key]} required={"required" in field && field.required} type={"type" in field ? field.type : "text"} />}</div>)}</div>{error && <p role="alert" className="notice error">{error}</p>}<div className="form-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Guardando…" : "Guardar cambios"}</button></div></form>}</section>;
}
