"use client";
import { useCallback, useEffect, useRef, useState } from "react";

type Preview = { label: string; confirmation: string; version: number; details: Record<string, number>; fingerprint: string };

export function DeleteDialog({ endpoint, close, deleted }: { endpoint: string; close: () => void; deleted: () => Promise<void> }) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const dialog = useRef<HTMLElement>(null);
  const field = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(""); setConfirm("");
    try {
      const response = await fetch(endpoint);
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "No se pudo obtener el detalle de la eliminación."); return; }
      setPreview(data); requestAnimationFrame(() => field.current?.focus());
    } catch { setError("No se pudo consultar el expediente. Reintenta."); }
  }, [endpoint]);
  useEffect(() => { void load(); }, [load]);

  async function remove() {
    if (!preview || confirm !== preview.confirmation) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm, fingerprint: preview.fingerprint }) });
      const data = await response.json();
      if (!response.ok) { setError(data.error ?? "No se pudo eliminar. Consulta el expediente antes de reintentar."); return; }
      await deleted();
    } catch { setError("No se pudo confirmar la eliminación. Verifica si el expediente aún existe antes de reintentar."); }
    finally { setBusy(false); }
  }

  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) close(); }}>
    <section className="dialog" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="delete-title" onKeyDown={(event) => {
      if (event.key === "Escape" && !busy) { event.preventDefault(); close(); }
      if (event.key === "Tab") {
        const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('input:not(:disabled),button:not(:disabled)') ?? [])];
        if (!focusable.length) return;
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable[focusable.length - 1].focus(); }
        else if (!event.shiftKey && document.activeElement === focusable[focusable.length - 1]) { event.preventDefault(); focusable[0].focus(); }
      }
    }}>
      <span className="eyebrow">Herramienta de superusuario</span>
      <h2 id="delete-title" style={{ marginTop: 8 }}>Eliminar definitivamente</h2>
      {preview && <>
        <p><strong>{preview.label}</strong></p>
        <p className="notice error">Se borrarán físicamente estos registros y sus auditorías relacionadas. Esta acción no se puede deshacer.</p>
        <div className="grid" style={{ gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 4 }}>{Object.entries(preview.details).filter(([, count]) => count > 0).map(([name, count]) => <div className="list-row" key={name}><span className="muted">{name.replaceAll("_", " ")}</span><strong>{name.endsWith("_COP") ? new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(count) : count}</strong></div>)}</div>
        <div className="field" style={{ marginTop: 18 }}><label htmlFor="delete-confirm">Escribe {preview.confirmation} para confirmar</label><input ref={field} id="delete-confirm" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="off" /></div>
      </>}
      {error && <p role="alert" className="notice error" style={{ marginTop: 14 }}>{error}</p>}
      <div className="form-actions"><button className="btn" disabled={busy} onClick={close}>Cancelar</button>{error && <button className="btn" disabled={busy} onClick={() => void load()}>Actualizar impacto</button>}<button className="btn btn-danger" disabled={busy || !preview || confirm !== preview.confirmation} onClick={() => void remove()}>{busy ? "Eliminando…" : "Eliminar definitivamente"}</button></div>
    </section>
  </div>;
}
