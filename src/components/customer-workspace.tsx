"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Plus, Search, UsersRound } from "lucide-react";
import { CustomerForm } from "@/components/customer-form";
import type { CustomerOption } from "@/components/customer-picker";

export function CustomerWorkspace({ canCreate }: { canCreate: boolean }) {
  const params = useSearchParams();
  const [creating, setCreating] = useState(params.get("crear") === "1");
  const [q, setQ] = useState("");
  const [customers, setCustomers] = useState<CustomerOption[]>([]);

  useEffect(() => {
    if (q.trim().length < 2) { setCustomers([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => fetch(`/api/customers?q=${encodeURIComponent(q)}`, { signal: controller.signal })
      .then((response) => response.json()).then((result) => setCustomers(result.customers ?? [])).catch(() => {}), 180);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [q]);

  return <>
    <div className="page-heading"><div><span className="eyebrow">Base maestra</span><h1>Clientes</h1><p className="muted">Una ficha para cada cliente. Todas sus ventas conectadas.</p></div>{canCreate && <button className="btn btn-primary" onClick={() => setCreating(!creating)}><Plus size={17} aria-hidden="true" />{creating ? "Cerrar formulario" : "Nuevo cliente"}</button>}</div>
    <div className="grid split"><section className="card"><div className="field"><label htmlFor="customer-search">Buscar cliente</label><div style={{ position: "relative" }}><Search size={18} style={{ position: "absolute", top: 13, left: 12 }} aria-hidden="true" /><input id="customer-search" style={{ paddingLeft: 40 }} value={q} onChange={(event) => setQ(event.target.value)} placeholder="Nombre, documento, teléfono o correo" /></div></div>
      {q.length < 2 ? <div className="muted" style={{ padding: "45px 10px", textAlign: "center" }}><UsersRound size={30} aria-hidden="true" /><p>Escribe al menos dos caracteres para buscar.</p></div> : customers.length ? <div style={{ marginTop: 18 }}>{customers.map((customer) => <Link className="list-row" href={`/clientes/${customer.id}`} key={customer.id}><span><strong>{customer.firstName} {customer.lastName}</strong><br /><span className="muted small">{customer.documentType ?? ""} {customer.documentNumber ?? ""} · {customer.phone}</span></span><span className="pill">Abrir ficha</span></Link>)}</div> : <p className="muted">No se encontraron coincidencias. Revisa variantes antes de crear una ficha.</p>}</section>
      <section>{creating && canCreate ? <div className="card"><h2>Crear ficha</h2><p className="muted small">Busca primero. Un documento repetido nunca crea otra ficha.</p><CustomerForm onCreated={(customer) => { setCreating(false); setQ(`${customer.firstName} ${customer.lastName}`); }} /></div> : <div className="card" style={{ background: "linear-gradient(135deg,#eef2ff,#f5f3ff)" }}><div className="stat-icon"><UsersRound size={20} /></div><h2 style={{ marginTop: 24 }}>Cada cliente, una sola vez.</h2><p className="muted">Antes de crear una ficha, búscala por nombre, teléfono o documento. Sus próximas ventas enriquecerán su historial.</p></div>}</section>
    </div>
  </>;
}
