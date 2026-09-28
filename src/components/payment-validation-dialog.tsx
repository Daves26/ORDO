"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { money } from "@/lib/format";
import { normalizeReceiptNumber } from "@/lib/receipt";

type Props = {
  payment: { id: string; amount: string; version: number };
  saleNumber: string;
  customerName: string;
  close: () => void;
  validated: () => Promise<void>;
};

export function PaymentValidationDialog({ payment, saleNumber, customerName, close, validated }: Props) {
  const [receiptNumber, setReceiptNumber] = useState("");
  const [step, setStep] = useState<"entry" | "confirmation">("entry");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const entry = useRef<HTMLInputElement>(null);
  const confirm = useRef<HTMLButtonElement>(null);
  const number = normalizeReceiptNumber(receiptNumber);

  useEffect(() => {
    if (step === "confirmation") confirm.current?.focus();
    else entry.current?.focus();
  }, [step]);

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!number || !/^[0-9]+$/.test(number)) {
      setError("Ingresa únicamente los dígitos del número de recibo.");
      return;
    }
    setError(""); setStep("confirmation");
  }

  async function validate() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/payments/${payment.id}/validate`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "VALIDAR", receiptNumber: number, version: payment.version }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "No se pudo validar el abono."); return; }
      await validated();
    } catch { setError("No se pudo confirmar la validación. Consulta el expediente antes de reintentar."); }
    finally { setBusy(false); }
  }

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) close(); }}>
    <section ref={dialog} className="dialog" role="dialog" aria-modal="true" aria-labelledby="validate-title" aria-describedby="validate-description" onKeyDown={(event) => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled)') ?? [])];
        if (!focusable.length) return;
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus(); }
      }
    }}>
      <span className="eyebrow">Cartera del cliente</span>
      <h2 id="validate-title" style={{ marginTop: 8 }}>{step === "entry" ? "Asociar recibo de caja" : "Confirmar validación"}</h2>
      <p id="validate-description" className="muted">{customerName} · {saleNumber}</p>
      <div className="list-row"><span className="muted">Valor del abono</span><strong>{money(payment.amount)} COP</strong></div>
      {step === "entry" ? <form onSubmit={review}>
        <div className="field" style={{ marginTop: 18 }}><label htmlFor="receipt-number">Número de recibo de caja *</label><input ref={entry} id="receipt-number" type="text" inputMode="numeric" pattern="[0-9]+" value={receiptNumber} onChange={(event) => { setReceiptNumber(event.target.value.replace(/\D/g, "")); setError(""); }} required maxLength={80} autoComplete="off" placeholder="Ej. 000123" /></div>
        <p className="muted small">Usa el número asignado al abono en el sistema contable.</p>
        {error && <p role="alert" className="notice error">{error}</p>}
        <div className="form-actions"><button type="button" className="btn" onClick={close}>Cancelar</button><button className="btn btn-primary" type="submit" disabled={!number}>Revisar validación</button></div>
      </form> : <>
        <div className="list-row"><span className="muted">Recibo de caja</span><strong>{number}</strong></div>
        <p className="notice warning" style={{ marginTop: 18 }}>¿Confirmas la validación de {money(payment.amount)} COP con el recibo de caja {number}? Se actualizará el saldo del cliente.</p>
        {error && <p role="alert" className="notice error">{error}</p>}
        <div className="form-actions"><button type="button" className="btn" disabled={busy} onClick={close}>Cancelar</button><button type="button" className="btn" disabled={busy} onClick={() => setStep("entry")}>Corregir RC</button><button ref={confirm} type="button" className="btn btn-primary" disabled={busy} onClick={() => void validate()}>{busy ? "Validando…" : "Confirmar validación"}</button></div>
      </>}
    </section>
  </div>;
}
