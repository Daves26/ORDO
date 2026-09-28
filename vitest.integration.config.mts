import "dotenv/config";
import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const testUrl = process.env.TEST_DATABASE_URL && new URL(process.env.TEST_DATABASE_URL);
const mainUrl = process.env.DATABASE_URL && new URL(process.env.DATABASE_URL);
if (!testUrl || !mainUrl || !/(^|[_-])test($|[_-])/i.test(testUrl.pathname.slice(1)) ||
  (testUrl.host === mainUrl.host && testUrl.pathname === mainUrl.pathname)) {
  throw new Error("Configura TEST_DATABASE_URL para una base de pruebas separada, cuyo nombre contenga '_test'.");
}

export default defineConfig({ test: { environment: "node", include: ["tests/**/*.integration.ts"], fileParallelism: false }, resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } } });
