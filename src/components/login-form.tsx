"use client";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
      const response = await result.json();
      if (!result.ok) { setError(response.error); return; }
      router.replace("/"); router.refresh();
    } catch { setError("No fue posible conectar con el servidor."); }
    finally { setBusy(false); }
  }
  return <form onSubmit={submit}>
    <div className="field"><label htmlFor="email">Correo electrónico</label><input id="email" name="email" type="email" autoComplete="username" required autoFocus placeholder="tu@agencia.com" /></div>
    <div className="field"><label htmlFor="password">Contraseña</label><input id="password" name="password" type="password" autoComplete="current-password" required /></div>
    {error && <p className="notice error" role="alert">{error}</p>}
    <button className="btn btn-primary" style={{ width: "100%" }} disabled={busy}>{busy ? "Ingresando…" : "Ingresar"}<ArrowRight size={17} aria-hidden="true" /></button>
  </form>;
}
