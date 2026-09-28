"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Command } from "lucide-react";
import { type CustomerOption } from "@/components/customer-picker";

export function GlobalSearch({ close, canSell }: { close: () => void; canSell: boolean }) {
  const router = useRouter(); const [query, setQuery] = useState(""); const [customers, setCustomers] = useState<CustomerOption[]>([]); const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    if (query.length < 2) { setCustomers([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => fetch(`/api/customers?q=${encodeURIComponent(query)}`, { signal: controller.signal }).then((r) => r.json()).then((data) => setCustomers(data.customers ?? [])).catch(() => {}), 180);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query]);
  function go(url: string) { close(); router.push(url); }
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) close(); }}><section ref={dialog} className="dialog" role="dialog" aria-modal="true" aria-label="Búsqueda global" onKeyDown={(e) => { if (e.key === "Escape") close(); if (e.key === "Tab") { const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>("input,button,a[href]") ?? [])]; if (!focusable.length) return; if (e.shiftKey && document.activeElement === focusable[0]) { e.preventDefault(); focusable[focusable.length - 1].focus(); } else if (!e.shiftKey && document.activeElement === focusable[focusable.length - 1]) { e.preventDefault(); focusable[0].focus(); } } }}>
    <div className="field"><label htmlFor="global-search">Buscar en Ordo</label><div style={{ display: "flex", alignItems: "center", gap: 8 }}><Search size={18} aria-hidden="true" /><input id="global-search" autoFocus placeholder="Nombre, documento, teléfono…" value={query} onChange={(e) => setQuery(e.target.value)} /></div></div>
    <div style={{ marginTop: 12 }}>{canSell && <button className="suggestion" onClick={() => go("/ventas/nueva")}><Command size={15} aria-hidden="true" /> Nueva venta</button>}{customers.map((c) => <button key={c.id} className="suggestion" onClick={() => go(`/clientes/${c.id}`)}>{c.firstName} {c.lastName} <span className="muted"> · {c.documentNumber || c.phone}</span></button>)}{query.length >= 2 && <button className="suggestion" onClick={() => go(`/ventas?q=${encodeURIComponent(query)}`)}>Buscar «{query}» en ventas →</button>}</div>
    <p className="muted small">Esc para cerrar · Enter en un resultado para abrir</p>
  </section></div>;
}
