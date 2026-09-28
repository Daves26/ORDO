"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { saleLabel, isOrderNumber } from "@/lib/sale-number";

type Props = { sale: { id: string; number: string; version: number }; close: () => void; updated: () => Promise<void> };

export function SaleOrderDialog({ sale, close, updated }: Props) {
  const [number, setNumber] = useState("");
  const [reason, setReason] = useState("");
  const [step, setStep] = useState<"entry" | "confirm">("entry");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const confirmation = useRef<HTMLButtonElement>(null);

  useEffect(() => { if (step === "entry") input.current?.focus(); else confirmation.current?.focus(); }, [step]);

  function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isOrderNumber(number)) { setError("La OS debe tener exactamente cuatro dígitos."); return; }
    if (number === sale.number) { setError("La OS ya tiene ese número."); return; }
    if (reason.trim().length < 3) { setError("Indica el motivo de la corrección."); return; }
    setError(""); setStep("confirm");
  }

  async function submit() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/sales/${sale.id}/os`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderNumber: number, version: sale.version, reason: reason.trim() }),
      });
      const result = await response.json();
      if (!response.ok) { setError(result.error ?? "No se pudo corregir la OS."); return; }
      await updated();
    } catch { setError("No se pudo confirmar el cambio. Consulta el expediente antes de reintentar."); }
    finally { setBusy(false); }
  }

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (!busy && event.target === event.currentTarget) close(); }}>
    <section ref={dialog} className="dialog" role="dialog" aria-modal="true" aria-labelledby="order-title" onKeyDown={(event) => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('input:not(:disabled),textarea:not(:disabled),button:not(:disabled)') ?? [])];
        if (!focusable.length) return;
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus(); }
      }
    }}>
      <span className="eyebrow">Contabilidad · Orden de servicio</span>
      <h2 id="order-title" style={{ marginTop: 8 }}>{step === "entry" ? "Corregir número de OS" : "Confirmar cambio de OS"}</h2>
      <div className="list-row"><span className="muted">Identificador actual</span><strong>{saleLabel(sale.number)}</strong></div>
      {step === "entry" ? <form onSubmit={review}>
        <div className="field" style={{ marginTop: 18 }}><label htmlFor="new-os">Número real de OS *</label><input ref={input} id="new-os" type="text" inputMode="numeric" pattern="[0-9]{4}" maxLength={4} required autoComplete="off" placeholder="Ej. 0123" value={number} onChange={(event) => { setNumber(event.target.value.replace(/\D/g, "").slice(0, 4)); setError(""); }} /></div>
        <div className="field" style={{ marginTop: 16 }}><label htmlFor="os-reason">Motivo *</label><textarea id="os-reason" required minLength={3} maxLength={300} rows={2} value={reason} onChange={(event) => setReason(event.target.value)} /></div>
        {error && <p role="alert" className="notice error">{error}</p>}
        <div className="form-actions"><button type="button" className="btn" onClick={close}>Cancelar</button><button className="btn btn-primary" disabled={!isOrderNumber(number) || reason.trim().length < 3}>Revisar cambio</button></div>
      </form> : <>
        <div className="list-row"><span className="muted">Nueva orden</span><strong>{saleLabel(number)}</strong></div>
        <p className="notice warning" style={{ marginTop: 18 }}>¿Confirmas el cambio de {saleLabel(sale.number)} a {saleLabel(number)}? El identificador anterior quedará registrado en el historial.</p>
        {error && <p role="alert" className="notice error">{error}</p>}
        <div className="form-actions"><button className="btn" disabled={busy} onClick={close}>Cancelar</button><button className="btn" disabled={busy} onClick={() => setStep("entry")}>Corregir</button><button ref={confirmation} className="btn btn-primary" disabled={busy} onClick={() => void submit()}>{busy ? "Guardando…" : "Confirmar cambio"}</button></div>
      </>}
    </section>
  </div>;
}
