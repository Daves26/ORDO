import { vi } from "vitest";

// Route handlers are invoked outside Next's request context in Vitest.
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  unstable_cache: (fn: (...args: unknown[]) => unknown) => fn,
}));
