"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { SERVICE_OPTIONS, type SaleServiceType } from "@/lib/service-types";

export function ServiceMultiSelect({ selected, onChange, disabled = false }: { selected: SaleServiceType[]; onChange: (values: SaleServiceType[]) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const choices = useRef<Partial<Record<SaleServiceType, HTMLInputElement | null>>>({});
  const listId = useId();

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) { if (!root.current?.contains(event.target as Node)) setOpen(false); }
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);

  function toggle(code: SaleServiceType) {
    onChange(selected.includes(code)
      ? selected.filter((type) => type !== code)
      : SERVICE_OPTIONS.filter((option) => option.code === code || selected.includes(option.code)).map((option) => option.code));
  }

  return <div ref={root} className="field full" onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }} onKeyDown={(event) => {
    if (!open) return;
    if (event.key === "Escape") { event.preventDefault(); setOpen(false); trigger.current?.focus(); }
    const index = SERVICE_OPTIONS.findIndex((option) => choices.current[option.code] === document.activeElement);
    if (index < 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const next = (index + (event.key === "ArrowDown" ? 1 : -1) + SERVICE_OPTIONS.length) % SERVICE_OPTIONS.length;
      choices.current[SERVICE_OPTIONS[next].code]?.focus();
    }
    if (event.key === "Enter") { event.preventDefault(); choices.current[SERVICE_OPTIONS[index].code]?.click(); }
  }}>
    <span id={`${listId}-label`} style={{ fontWeight: 700, color: "#334155", fontSize: 13 }}>Servicios incluidos *</span>
    <button ref={trigger} type="button" className="btn" aria-labelledby={`${listId}-label ${listId}-summary`} aria-controls={listId} aria-expanded={open} disabled={disabled} style={{ width: "100%", justifyContent: "space-between", textAlign: "left", whiteSpace: "normal" }} onClick={() => {
      if (open) { setOpen(false); return; }
      setOpen(true); requestAnimationFrame(() => choices.current[SERVICE_OPTIONS[0].code]?.focus());
    }}><span id={`${listId}-summary`}>{selected.length ? SERVICE_OPTIONS.filter((option) => selected.includes(option.code)).map((option) => option.label).join(", ") : "Selecciona uno o varios servicios"}</span><ChevronDown size={18} aria-hidden="true" /></button>
    {open && <div id={listId} className="service-multiselect-options" aria-labelledby={`${listId}-label`}><div className="muted small" style={{ padding: "5px 10px" }}>Usa Tab, flechas y Espacio para elegir. Escape cierra el selector.</div>{SERVICE_OPTIONS.map((option) => <label className="service-option" key={option.code}><input ref={(element) => { choices.current[option.code] = element; }} type="checkbox" checked={selected.includes(option.code)} disabled={disabled} onChange={() => toggle(option.code)} />{option.label}{selected.includes(option.code) && <Check size={17} aria-hidden="true" style={{ marginLeft: "auto", color: "var(--primary)" }} />}</label>)}</div>}
    {!selected.length && <span className="field-hint">Selecciona al menos un servicio para crear la orden.</span>}
  </div>;
}
