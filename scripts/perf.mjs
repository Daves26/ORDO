import "dotenv/config";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { performance } from "node:perf_hooks";

if (!process.env.SEED_MANAGER_EMAIL || !process.env.SEED_MANAGER_PASSWORD) throw new Error("Configura las credenciales del seed para medir rutas autenticadas.");
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

const percentile = (items, part) => items.slice().sort((a, b) => a - b)[Math.ceil(items.length * part) - 1].toFixed(0);
async function measure(path, cookie, attempts = 12) {
  const firstStart = performance.now();
  const cold = await fetch(`${origin}${path}`, { headers: { cookie }, cache: "no-store" });
  await cold.text();
  if (!cold.ok) throw new Error(`${path}: HTTP ${cold.status}`);
  const coldMs = performance.now() - firstStart;
  const samples = [];
  for (let i = 0; i < attempts; i++) {
    const started = performance.now();
    const response = await fetch(`${origin}${path}`, { headers: { cookie }, cache: "no-store" });
    const headersAt = performance.now();
    const bytes = Buffer.byteLength(await response.text());
    if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
    samples.push({ ttfb: headersAt - started, total: performance.now() - started, bytes });
  }
  console.log(`${path.padEnd(38)} frío ${coldMs.toFixed(0)} ms · TTFB caliente p50/p95 ${percentile(samples.map((s) => s.ttfb), .5)}/${percentile(samples.map((s) => s.ttfb), .95)} ms · total ${percentile(samples.map((s) => s.total), .5)}/${percentile(samples.map((s) => s.total), .95)} ms · ${samples.at(-1).bytes} bytes`);
}
async function burst(path, cookie, concurrency = 10) {
  const outcomes = await Promise.all(Array.from({ length: concurrency }, async () => {
    const started = performance.now();
    const response = await fetch(`${origin}${path}`, { headers: { cookie }, cache: "no-store" });
    const ttfb = performance.now() - started;
    await response.arrayBuffer();
    return { status: response.status, ttfb, elapsed: performance.now() - started };
  }));
  if (outcomes.some(({ status }) => status !== 200)) throw new Error(`${path}: respuesta no exitosa durante carga concurrente.`);
  console.log(`${path} · ${concurrency} peticiones simultáneas · total p50/p95 ${percentile(outcomes.map(({ elapsed }) => elapsed), .5)}/${percentile(outcomes.map(({ elapsed }) => elapsed), .95)} ms`);
  if (outcomes.some(({ elapsed }) => elapsed > 500)) console.log(`  Peticiones lentas: ${outcomes.filter(({ elapsed }) => elapsed > 500).map(({ ttfb, elapsed }) => `TTFB ${ttfb.toFixed(0)} / total ${elapsed.toFixed(0)} ms`).join(" · ")}`);
}

try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode != null) throw new Error("El servidor de producción no arrancó; ejecuta npm run build.");
    try { if ((await fetch(`${origin}/login`)).ok) { ready = true; break; } } catch { /* Esperar. */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (!ready) throw new Error("El servidor no respondió.");
  const login = await fetch(`${origin}/api/auth/login`, { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify({ email: process.env.SEED_MANAGER_EMAIL, password: process.env.SEED_MANAGER_PASSWORD }) });
  if (!login.ok) throw new Error("No fue posible iniciar sesión con el usuario de medición.");
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  if (!cookie) throw new Error("No se recibió la sesión de medición.");
  try {
    const listing = await (await fetch(`${origin}/api/sales`, { headers: { cookie } })).json();
    const first = listing.sales?.[0];
    const paths = ["/", "/ventas", "/clientes", "/ventas/nueva", "/api/sales"];
    if (first) paths.push(`/ventas/${first.id}`, `/api/sales/${first.id}`, `/api/sales/${first.id}/order-details`, `/api/customers?q=${encodeURIComponent(first.customer.firstName)}`);
    console.log("Medición HTTP serial de producción local; no mide LCP/INP ni latencia remota. Repetir con datos y carga representativos.");
    for (const path of paths) await measure(path, cookie);
    if (first) {
      const detail = await (await fetch(`${origin}/ventas/${first.id}`, { headers: { cookie } })).text();
      if (!detail.includes("Datos de los pasajeros") || detail.includes("Abriendo expediente")) throw new Error("El expediente inicial volvió a depender de una carga posterior desde el navegador.");
    }
    const concurrency = Math.max(1, Math.min(100, Number(process.env.PERF_CONCURRENCY) || 10));
    for (const path of ["/", "/ventas", ...(first ? [`/ventas/${first.id}`] : [])]) await burst(path, cookie, concurrency);
  } finally {
    await fetch(`${origin}/api/auth/logout`, { method: "POST", headers: { origin, cookie } });
  }
} finally { server.kill(); }
