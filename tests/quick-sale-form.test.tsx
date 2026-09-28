// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const navigation = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));

import { QuickSaleForm } from "@/components/quick-sale-form";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); navigation.push.mockReset(); navigation.refresh.mockReset(); });

it("bloquea la captura hasta crear al cliente y convierte DD/MM/AAAA a ISO al registrar la venta", async () => {
  const customer = { id: crypto.randomUUID(), code: "CLI-1", firstName: "Juan", lastName: "Pérez", phone: "3001234567", documentNumber: null, documentType: null, email: null, city: null };
  const send = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
    if (url.startsWith("/api/customers?q=")) return { ok: true, json: async () => ({ customers: [] }) };
    if (url.startsWith("/api/sales/os/availability?")) return { ok: true, json: async () => ({ available: true }) };
    if (url === "/api/customers") return { ok: true, json: async () => ({ customer }) };
    if (url === "/api/sales") return { ok: true, json: async () => ({ id: "venta-1" }) };
    throw new Error(`unexpected ${url} ${init?.method}`);
  });
  vi.stubGlobal("fetch", send);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  render(<QuickSaleForm />);

  const destination = screen.getByLabelText("Destino *") as HTMLInputElement;
  expect(destination.matches(":disabled")).toBe(true);
  expect((screen.getByRole("button", { name: "Crear venta" }) as HTMLButtonElement).disabled).toBe(true);

  fireEvent.change(screen.getByLabelText("Cliente *"), { target: { value: "Juan Pérez" } });
  const noResults = await screen.findByText("No encontramos este cliente. Créalo para continuar.");
  expect(noResults).toBeTruthy();
  expect(screen.getByLabelText("Cliente *").getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByLabelText("Cliente *").className).toContain("customer-not-found");
  fireEvent.click(screen.getByRole("button", { name: "Crear cliente aquí" }));
  const first = screen.getByLabelText("Nombres *") as HTMLInputElement;
  const last = screen.getByLabelText("Apellidos *") as HTMLInputElement;
  expect(first.value).toBe("Juan"); expect(last.value).toBe("Pérez");
  fireEvent.change(first, { target: { value: "jUAN" } });
  expect(first.value).toBe("Juan");
  fireEvent.change(screen.getByLabelText("Teléfono *"), { target: { value: "3001234567" } });
  fireEvent.submit(screen.getByRole("button", { name: "Crear cliente" }).closest("form")!);
  await waitFor(() => expect(destination.matches(":disabled")).toBe(false));
  expect(screen.getByText("Juan Pérez")).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Número de orden de servicio *"), { target: { value: "0123" } });
  await screen.findByText("OS disponible.");
  fireEvent.change(destination, { target: { value: "Cancún" } });
  fireEvent.change(screen.getByLabelText("Salida"), { target: { value: "15112026" } });
  fireEvent.change(screen.getByLabelText("Regreso"), { target: { value: "20112026" } });
  fireEvent.change(screen.getByLabelText("Valor total · COP *"), { target: { value: "8000000" } });
  expect((screen.getByLabelText("Salida") as HTMLInputElement).value).toBe("15/11/2026");
  fireEvent.submit(screen.getByRole("button", { name: "Crear venta" }).closest("form")!);
  await waitFor(() => expect(navigation.push).toHaveBeenCalledWith("/ventas/venta-1"));
  const call = send.mock.calls.find(([url]) => url === "/api/sales")!;
  expect(JSON.parse((call[1] as RequestInit).body as string)).toMatchObject({ customerId: customer.id, orderNumber: "0123", startsAt: "2026-11-15", endsAt: "2026-11-20", total: 8_000_000 });
  expect(screen.queryByLabelText(/Referencia/i)).toBeNull();
});

it("separa un fallo de búsqueda de un cliente inexistente", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 503 }));
  render(<QuickSaleForm />);
  fireEvent.change(screen.getByLabelText("Cliente *"), { target: { value: "No disponible" } });
  await screen.findByText("No se pudo consultar la base. Reintenta la búsqueda.");
  expect(screen.getByLabelText("Cliente *").getAttribute("aria-invalid")).toBeNull();
  expect(screen.queryByRole("button", { name: "Crear cliente aquí" })).toBeNull();
});
