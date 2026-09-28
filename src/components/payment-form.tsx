"use client";
import { useState, type FormEvent } from "react";
import { money } from "@/lib/format";

export function PaymentForm({ id, max, saved }: { id: string; max: number; saved: () => Promise<void> }) {
  const [amount, setAmount] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); setError(""); if (Number(amount) > max) { setError("El abono supera el saldo considerando pagos por validar."); return; }
    setBusy(true); const form = e.currentTarget; const data = new FormData(form);
    try {
      const res = await fetch(`/api/sales/${id}/payments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ amount: Number(amount), method: data.get("method"), requestId }) });
      if (!res.ok) { setError((await res.json()).error); return; }
      setRequestId(crypto.randomUUID()); setAmount(""); form.reset(); await saved();
    } catch { setError("No se confirmó el registro. Reintenta sin cambiar los datos para evitar duplicados."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit} style={{ borderTop: "1px solid var(--border)", marginTop: 25, paddingTop: 20 }}><h2>Reportar otro abono</h2><div className="form-grid"><div className="field"><label htmlFor="payment-amount">Valor · COP</label><input id="payment-amount" inputMode="numeric" required value={amount ? money(amount) : ""} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} /><span className="field-hint">Máximo: {money(max)}</span></div><div className="field"><label htmlFor="payment-method">Medio</label><select id="payment-method" name="method"><option value="TRANSFERENCIA">Transferencia</option><option value="EFECTIVO">Efectivo</option><option value="TARJETA">Tarjeta</option><option value="CONSIGNACION">Consignación</option><option value="OTRO">Otro</option></select></div></div>{error && <p role="alert" className="notice error">{error}</p>}<div className="form-actions"><button disabled={busy || Number(amount) < 1} className="btn btn-primary">{busy ? "Registrando…" : "Reportar pago"}</button></div></form>;
}
