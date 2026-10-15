import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({ test: { environment: "node", include: ["tests/**/*.test.{ts,tsx}"], setupFiles: ["./tests/setup-cache.ts"] }, resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } } });
