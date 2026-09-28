import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return <div className="login-shell">
    <aside className="login-aside">
      <div className="brand" style={{ padding: 0 }}><span className="brand-mark">✦</span> ordo</div>
      <div><div className="eyebrow" style={{ color: "#ddd6fe" }}>Una sola fuente de verdad</div><h1>Todos los viajes, en orden.</h1><p style={{ maxWidth: 470, opacity: .9 }}>De la primera conversación al último voucher. Tu operación conectada en un solo expediente.</p></div>
      <span className="small">Gestión interna · Acceso protegido</span>
    </aside>
    <main className="login-form"><div><div className="eyebrow">Bienvenido de nuevo</div><h1>Inicia sesión</h1><p className="muted" style={{ marginBottom: 30 }}>Ingresa con tu cuenta de la agencia para continuar.</p><LoginForm /></div></main>
  </div>;
}
