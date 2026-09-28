"use client";
import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { CustomerForm } from "@/components/customer-form";

export type CustomerOption = { id: string; code: string; firstName: string; lastName: string; phone: string; documentType: string | null; documentNumber: string | null; email: string | null; city: string | null };
type SearchStatus = "idle" | "loading" | "found" | "empty" | "error";

export function CustomerPicker({ selected, onSelect, inlineCreate = false }: { selected: CustomerOption | null; onSelect: (customer: CustomerOption | null) => void; inlineCreate?: boolean }) {
  const [text, setText] = useState("");
  const [options, setOptions] = useState<CustomerOption[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState<{ query: string; status: SearchStatus }>({ query: "", status: "idle" });
  const id = useId();
  const query = text.trim();
  const noResults = !selected && query.length >= 2 && search.query === query && search.status === "empty";

  useEffect(() => {
    if (selected || query.length < 2) { setOptions([]); setSearch({ query, status: "idle" }); return; }
    const controller = new AbortController();
    setSearch({ query, status: "loading" });
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/customers?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        if (!response.ok) throw new Error("No se pudo buscar clientes.");
        const result = await response.json();
        const found = result.customers as CustomerOption[];
        if (controller.signal.aborted) return;
        setOptions(found); setActive(0); setOpen(true);
        setSearch({ query, status: found.length ? "found" : "empty" });
      } catch { if (!controller.signal.aborted) { setOptions([]); setSearch({ query, status: "error" }); } }
    }, 180);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, selected]);

  function choose(option: CustomerOption) { onSelect(option); setOpen(false); setCreating(false); setText(""); }

  return <div className="field customer-picker">
    <label htmlFor={id}>Cliente *</label>
    {selected ? <div className="notice" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}><span><strong>{selected.firstName} {selected.lastName}</strong> · {selected.documentNumber ?? selected.phone}</span><button className="btn" type="button" onClick={() => { onSelect(null); setText(""); }}>Cambiar</button></div> : <>
      <input id={id} role="combobox" className={noResults ? "customer-not-found" : ""} aria-invalid={noResults || undefined} aria-describedby={`${id}-status`} aria-autocomplete="list" aria-expanded={open && options.length > 0} aria-controls={`${id}-options`} aria-activedescendant={open && options.length ? `${id}-opt-${active}` : undefined} autoComplete="off" placeholder="Escribe nombre, documento o teléfono" value={text} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 130)} onChange={(event) => { setText(event.target.value); setOpen(true); }} onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
        if (event.key === "ArrowDown" && options.length) { event.preventDefault(); setOpen(true); setActive((active + 1) % options.length); }
        if (event.key === "ArrowUp" && options.length) { event.preventDefault(); setOpen(true); setActive((active - 1 + options.length) % options.length); }
        if (event.key === "Enter" && open && options.length) { event.preventDefault(); choose(options[active]); }
      }} />
      {open && options.length > 0 && <div className="suggestions" role="listbox" id={`${id}-options`}>{options.map((option, index) => <button id={`${id}-opt-${index}`} type="button" role="option" aria-selected={active === index} className={`suggestion ${active === index ? "selected" : ""}`} key={option.id} onMouseDown={(event) => event.preventDefault()} onClick={() => choose(option)}>{option.firstName} {option.lastName} <span className="muted"> · {option.documentType ?? ""} {option.documentNumber ?? option.phone}</span></button>)}</div>}
      <span id={`${id}-status`} role="status" className={noResults ? "field-error" : "field-hint"}>
        {noResults ? "No encontramos este cliente. Créalo para continuar." : search.query === query && search.status === "error" ? "No se pudo consultar la base. Reintenta la búsqueda." : search.query === query && search.status === "loading" ? "Buscando clientes…" : "Busca primero para evitar fichas duplicadas."}
      </span>
      {inlineCreate ? <>
        {(noResults || creating) && <button type="button" className="btn" onClick={() => { setCreating(!creating); setOpen(false); }}>{creating ? "Cerrar ficha de cliente" : "Crear cliente aquí"}</button>}
        {creating && <div className="card" style={{ marginTop: 8 }}><strong>Nuevo cliente</strong><p className="muted small">Crearás una ficha reutilizable; luego podrás continuar esta venta.</p><CustomerForm initialQuery={text} onCreated={choose} onExisting={choose} /></div>}
      </> : <span className="field-hint">¿No aparece? <Link href="/clientes?crear=1" style={{ color: "var(--primary)", fontWeight: 700 }}>Crear cliente</Link> y vuelve a la venta.</span>}
    </>}
  </div>;
}
