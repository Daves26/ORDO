"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, UsersRound, BriefcaseBusiness, Search, Plus, LogOut, Settings } from "lucide-react";
import type { Actor } from "@/lib/auth";
import { GlobalSearch } from "@/components/global-search";

export function Shell({ actor, children }: { actor: Actor; children: ReactNode }) {
  const path = usePathname(); const router = useRouter(); const [search, setSearch] = useState(false); const searchTrigger = useRef<HTMLButtonElement>(null);
  const canSell = actor.roles.includes("ASESOR") || actor.roles.includes("GERENTE") || actor.roles.includes("ADMINISTRADOR");
  const canSearch = true;
  useEffect(() => {
    function key(event: KeyboardEvent) {
      if (event.ctrlKey && event.key.toLowerCase() === "k" && canSearch) { event.preventDefault(); setSearch(true); }
      if (event.ctrlKey && event.key.toLowerCase() === "n" && canSell) { event.preventDefault(); router.push("/ventas/nueva"); }
    }
    document.addEventListener("keydown", key); return () => document.removeEventListener("keydown", key);
  }, [canSell, canSearch, router]);
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); router.refresh(); }
  const links = [{ href: "/", label: "Inicio", icon: LayoutDashboard }, { href: "/clientes", label: "Clientes", icon: UsersRound }, { href: "/ventas", label: "Ventas", icon: BriefcaseBusiness }, ...(actor.roles.includes("ADMINISTRADOR") ? [{ href: "/usuarios", label: "Usuarios", icon: Settings }] : [])];
  return <div className="app-shell">
    <aside className="sidebar" inert={search}><Link href="/" className="brand"><span className="brand-mark">✦</span> ordo</Link><nav aria-label="Navegación principal"><div className="nav-heading">Espacio de trabajo</div>{links.map(({ href, label, icon: Icon }) => <Link key={href} className={`nav-link ${path === href || (href !== "/" && path.startsWith(href + "/")) ? "active" : ""}`} href={href}><Icon size={19} aria-hidden="true" />{label}</Link>)}</nav><div className="sidebar-foot"><span className="muted small">Sesión activa</span><div style={{ fontWeight: 700, marginTop: 4 }}>{actor.name}</div><div className="muted small">{actor.roles.join(" · ")}</div></div></aside>
    <div className="main" inert={search}><header className="topbar"><button ref={searchTrigger} className="btn" onClick={() => setSearch(true)} aria-label="Abrir búsqueda global"><Search size={18} aria-hidden="true" /><span className="muted">Buscar cliente o venta</span><span className="kbd">Ctrl K</span></button><div className="topbar-actions">{canSell && <Link href="/ventas/nueva" className="btn btn-primary"><Plus size={17} aria-hidden="true" /> Nueva venta</Link>}<button className="btn btn-quiet" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={logout}><LogOut size={19} aria-hidden="true" /></button></div></header><main className="content">{children}</main></div>
    {search && <GlobalSearch close={() => { setSearch(false); requestAnimationFrame(() => searchTrigger.current?.focus()); }} canSell={canSell} />}
  </div>;
}
