"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { money } from "@/lib/format";

type Props = {
  payment: { id: string; amount: string; version: number; status: string; receipt: { number: string } | null };
  balance: number;
  projectedBalance: number;
  close: () => void;
  updated: () => Promise<void>;
};

export function PaymentAmountDialog({ payment, balance, projectedBalance, close, updated }: Props) {
  const [amount, setAmount] = useState(String(Number(payment.amount)));
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"entry" | "confirm">("entry");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLButtonElement>(null);
  const next = Number(amount || 0);
  const difference = next - Number(payment.amount);
  const validated = payment.status === "VALIDADO";

  useEffect(() => { if (step === "entry") input.current?.focus(); else confirmation.current?.focus(); }, [step]);

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!Number.isSafeInteger(next) || next <= 0) { setError("Ingresa un valor positivo en COP."); return; }
    if (!difference) { setError("El nuevo valor coincide con el actual."); return; }
    if ((validated ? balance : projectedBalance) - difference < 0) { setError("El nuevo valor supera el saldo disponible, incluidos abonos por validar."); return; }
    if (reason.trim().length < 3) { setError("Indica el motivo de la corrección."); return; }
    setError(""); setStep("confirm");
  }

  async function submit() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/payments/${payment.id}/amount`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: next, version: payment.version, reason: reason.trim() }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "No se pudo corregir el valor."); return; }
      await updated();
    } catch { setError("No se pudo confirmar la corrección. Consulta el expediente antes de reintentar."); }
    finally { setBusy(false); }
  }

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) close(); }}>
    <section ref={dialog} className="dialog" role="dialog" aria-modal="true" aria-labelledby="amount-title" onKeyDown={(event) => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('input:not(:disabled),textarea:not(:disabled),button:not(:disabled)') ?? [])];
        if (!focusable.length) return;
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus(); }
      }
    }}>
      <span className="eyebrow">Contabilidad · Cartera</span>
      <h2 id="amount-title" style={{ marginTop: 8 }}>{step === "entry" ? "Corregir valor del abono" : "Confirmar corrección de valor"}</h2>
      <div className="list-row"><span className="muted">Valor actual</span><strong>{money(payment.amount)}</strong></div>
      <div className="list-row"><span className="muted">Estado</span><span className="pill">{payment.status}</span></div>
      {payment.receipt && <div className="list-row"><span className="muted">Número del recibo</span><strong>{payment.receipt.number}</strong></div>}
      {step === "entry" ? <form onSubmit={review}>
        <div className="field" style={{ marginTop: 18 }}><label htmlFor="correct-amount">Nuevo valor · COP *</label><input ref={input} id="correct-amount" inputMode="numeric" required value={amount ? money(amount) : ""} onChange={(event) => { setAmount(event.target.value.replace(/\D/g, "")); setError(""); }} /></div>
        <div className="field" style={{ marginTop: 16 }}><label htmlFor="amount-reason">Motivo *</label><textarea id="amount-reason" required minLength={3} maxLength={300} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /></div>
        {error && <p role="alert" className="notice error">{error}</p>}
        <div className="form-actions"><button type="button" className="btn" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={!next || !difference || reason.trim().length < 3}>Revisar corrección</button></div>
      </form> : <>
        <div className="list-row"><span className="muted">Nuevo valor</span><strong>{money(next)}</strong></div>
        <div className="list-row"><span className="muted">{validated ? "Nuevo saldo contable" : "Nuevo saldo proyectado"}</span><strong>{money((validated ? balance : projectedBalance) - difference)}</strong></div>
        <p className="notice warning" style={{ marginTop: 18 }}>¿Confirmas cambiar el abono de {money(payment.amount)} a {money(next)}{payment.receipt ? ` y conservar el recibo número ${payment.receipt.number}` : ""}? El valor anterior y el motivo quedarán registrados.{payment.receipt && " Confirma que el recibo ya tenga este valor en el sistema contable."}</p>
        {error && <p role="alert" className="notice error">{error}</p>}
        <div className="form-actions"><button className="btn" disabled={busy} onClick={close}>Cancelar</button><button className="btn" disabled={busy} onClick={() => setStep("entry")}>Corregir</button><button ref={confirmation} className="btn btn-primary" disabled={busy} onClick={() => void submit()}>{busy ? "Guardando…" : "Confirmar corrección"}</button></div>
      </>}
    </section>
  </div>;
}
