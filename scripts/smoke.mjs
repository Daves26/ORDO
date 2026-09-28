import "dotenv/config";
import { spawn } from "node:child_process";
import { createServer } from "node:net";

if (!process.env.SEED_MANAGER_EMAIL || !process.env.SEED_MANAGER_PASSWORD) throw new Error("Configura credenciales de gerencia del seed en .env.");

const port = await new Promise((resolve, reject) => {
  const server = createServer().once("error", reject).listen(0, "127.0.0.1", () => {
    const assigned = server.address().port;
    server.close(() => resolve(assigned));
  });
});
const origin = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", String(port)], {
  env: { ...process.env, APP_ORIGIN: origin }, stdio: "ignore", windowsHide: true,
});

try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode != null) throw new Error(`Servidor finalizó con código ${server.exitCode}. Ejecuta npm run build primero.`);
    try { const result = await fetch(`${origin}/login`); if (result.ok) { ready = true; break; } } catch { /* esperando */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("Servidor no inició a tiempo.");
  const denied = await fetch(`${origin}/api/sales`);
  if (denied.status !== 401) throw new Error(`Ruta sin sesión devolvió ${denied.status}, esperaba 401.`);
  const login = await fetch(`${origin}/api/auth/login`, {
    method: "POST", headers: { origin, "content-type": "application/json" },
    body: JSON.stringify({ email: process.env.SEED_MANAGER_EMAIL, password: process.env.SEED_MANAGER_PASSWORD }),
  });
  if (!login.ok) throw new Error(`Inicio de sesión devolvió ${login.status}. Comprueba el seed y las credenciales locales.`);
  const setCookie = login.headers.get("set-cookie");
  if (!setCookie || !/httponly/i.test(setCookie) || !/samesite=lax/i.test(setCookie)) throw new Error("Cookie de sesión sin protección esperada.");
  const cookie = setCookie.split(";")[0];
  const authorized = await fetch(`${origin}/api/sales`, { headers: { cookie } });
  if (!authorized.ok) throw new Error(`Consulta autenticada devolvió ${authorized.status}.`);
  const logout = await fetch(`${origin}/api/auth/logout`, { method: "POST", headers: { origin, cookie } });
  if (!logout.ok) throw new Error(`Cierre de sesión devolvió ${logout.status}.`);
  const revoked = await fetch(`${origin}/api/sales`, { headers: { cookie } });
  if (revoked.status !== 401) throw new Error("La sesión siguió activa tras cerrar sesión.");
  console.log("HTTP real: acceso protegido, login, lectura autenticada y logout correctos.");
} finally {
  server.kill();
}
