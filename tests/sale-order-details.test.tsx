// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SaleOrderDetails } from "@/components/sale-order-details";
import { addDaysIsoDate, fromIsoDate } from "@/lib/local-date";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const passenger = { id: "p-1", firstName: "Ana", lastName: "Viajes", documentType: null, documentNumber: null, birthDate: "1990-06-12", passportNumber: null, passportExpiry: "2030-06-12" };
const sample = { version: 2, passengers: [{ passenger }] };

it("presenta solo pasajeros y guarda los cambios con la versión de la OS", async () => {
  const send = vi.fn(async (_url: string, init?: RequestInit) => init?.method === "PATCH" ? { ok: true, json: async () => ({ version: 3 }) } : { ok: true, json: async () => ({ sale: sample }) });
  const saved = vi.fn(async () => {});
  vi.stubGlobal("fetch", send);
  render(<SaleOrderDetails saleId="sale-1" initial={sample} canEditOperational saved={saved} />);
  expect(await screen.findByRole("heading", { name: "Datos de los pasajeros" })).toBeTruthy();
  expect(screen.queryByText(/Formato físico|Facturar a|Servicios y emitido por|Valores por tipo de pasajero/)).toBeNull();
  fireEvent.change(screen.getByLabelText("Nombres *"), { target: { value: "María" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar pasajeros" }));
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  expect(JSON.parse(send.mock.calls.find(([, init]) => init?.method === "PATCH")![1]!.body as string)).toMatchObject({ section: "passengers", version: 2, passengers: [{ id: "p-1", firstName: "María" }] });
  expect(send.mock.calls.every(([url]) => url === "/api/sales/sale-1/order-details")).toBe(true);
  expect(send).toHaveBeenCalledTimes(1);
});

it("permite consultar pasajeros sin permisos de edición", async () => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ sale: sample }) })));
  render(<SaleOrderDetails saleId="sale-1" initial={sample} canEditOperational={false} saved={async () => {}} />);
  expect((await screen.findByLabelText("Nombres *") as HTMLInputElement).closest("fieldset")?.disabled).toBe(true);
  expect(screen.queryByRole("button", { name: "Añadir pasajero" })).toBeNull();
});

it.each([
  { label: "Fecha de nacimiento", field: "birthDate", date: "12/06/1990", typed: "13061990", iso: "1990-06-13" },
  { label: "Vencimiento de pasaporte", field: "passportExpiry", date: "12/06/2030", typed: "13062030", iso: "2030-06-13" },
])("$label permite escribir y seleccionar en calendario y guarda ISO", async ({ label, field, date, typed, iso }) => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  const send = vi.fn(async (_url: string, init?: RequestInit) => init?.method === "PATCH" ? { ok: true, json: async () => ({ version: 3 }) } : { ok: true, json: async () => ({ sale: sample }) });
  vi.stubGlobal("fetch", send);
  render(<SaleOrderDetails saleId="sale-1" initial={sample} canEditOperational saved={async () => {}} />);
  const input = await screen.findByLabelText(label) as HTMLInputElement;
  expect(input.value).toBe(date);
  fireEvent.change(input, { target: { value: typed } });
  expect(input.value).toBe(`${typed.slice(0, 2)}/${typed.slice(2, 4)}/${typed.slice(4)}`);
  fireEvent.click(input);
  expect(screen.getByRole("dialog", { name: `Calendario de ${label}` })).toBeTruthy();
  const selectedIso = addDaysIsoDate(iso, 1);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`\\b${Number(selectedIso.slice(8))} de `, "i") }));
  expect(input.value).toBe(fromIsoDate(selectedIso));
  fireEvent.click(screen.getByRole("button", { name: "Guardar pasajeros" }));
  await waitFor(() => expect(send.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true));
  expect(JSON.parse(send.mock.calls.find(([, init]) => init?.method === "PATCH")![1]!.body as string).passengers[0][field]).toBe(selectedIso);
});

it("rechaza fechas imposibles antes de guardar pasajeros", async () => {
  const send = vi.fn(async () => ({ ok: true, json: async () => ({ sale: sample }) }));
  vi.stubGlobal("fetch", send);
  render(<SaleOrderDetails saleId="sale-1" initial={sample} canEditOperational saved={async () => {}} />);
  const input = await screen.findByLabelText("Fecha de nacimiento");
  fireEvent.change(input, { target: { value: "31021990" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar pasajeros" }));
  expect(screen.getByRole("alert").textContent).toContain("Revisa las fechas");
  expect(send.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
});
