// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SaleOrderDetails } from "@/components/sale-order-details";
import { addDaysIsoDate, fromIsoDate } from "@/lib/local-date";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const sample = { id: "sale-1", number: "0123", version: 2, requestedAt: null, contactName: null, holderName: null,
  billingName: null, billingDocument: null, billingPhone: null, billingAddress: null, billingCity: null,
  customer: { firstName: "Ana", lastName: "Viajes", documentNumber: "123", phone: "3001234567", address: null, city: null, billingName: null, billingDocument: null },
  passengers: [], services: [{ id: "service-1", type: "VUELO", route: null, planType: null, baggage: null, transportCompany: null, hotelName: null, supplierId: null, supplier: null, flightSegments: [] }],
  priceLines: [{ category: "ADULTO", quantity: 2, unitPrice: "400000" }], total: "1000000", customerDueAt: "2027-02-10" };

it("muestra un desglose distinto al total y envía personas/version sin duplicar las fechas ya existentes", async () => {
  const send = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === "/api/suppliers") return { ok: true, json: async () => ({ suppliers: [] }) };
    if (init?.method === "PATCH") return { ok: true, json: async () => ({ version: 3 }) };
    return { ok: true, json: async () => ({ sale: sample }) };
  });
  const saved = vi.fn(async () => {});
  vi.stubGlobal("fetch", send);
  render(<SaleOrderDetails saleId="sale-1" saleVersion={2} canEditCommercial canEditOperational canViewFinancial saved={saved} />);
  expect(await screen.findByText(/Diferencia de.*respecto al total acordado/)).toBeTruthy();
  expect(screen.getByText(/N.º RSVA: los localizadores/)).toBeTruthy();
  expect(screen.queryByText("Orden de servicio en PDF")).toBeNull();
  fireEvent.change(screen.getByLabelText("Contacto"), { target: { value: "María Acosta" } });
  fireEvent.submit(screen.getByRole("button", { name: "Guardar personas y facturación" }).closest("form")!);
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const write = send.mock.calls.find(([, init]) => init?.method === "PATCH")!;
  expect(JSON.parse(write[1]!.body as string)).toMatchObject({ section: "people", version: 2, contactName: "María Acosta" });
});

it("back office edita operación sin ver precios financieros", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/api/suppliers" ? { ok: true, json: async () => ({ suppliers: [] }) } : { ok: true, json: async () => ({ sale: { ...sample, total: undefined, priceLines: undefined } }) }));
  render(<SaleOrderDetails saleId="sale-1" saleVersion={2} canEditCommercial={false} canEditOperational canViewFinancial={false} saved={async () => {}} />);
  expect(await screen.findByRole("button", { name: "Añadir tramo de vuelo" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Añadir pasajero" })).toBeTruthy();
  expect(screen.queryByText("Valores por tipo de pasajero · COP")).toBeNull();
  expect(screen.queryByText("Orden de servicio en PDF")).toBeNull();
});

it.each([
  { label: "Fecha de solicitud", button: "Guardar personas y facturación", section: "people", field: "requestedAt", date: "05/01/2027", typed: "06012027", iso: "2027-01-06" },
  { label: "Fecha de nacimiento", button: "Guardar pasajeros", section: "passengers", field: "birthDate", date: "12/06/1990", typed: "13061990", iso: "1990-06-13" },
  { label: "Vencimiento de pasaporte", button: "Guardar pasajeros", section: "passengers", field: "passportExpiry", date: "12/06/2030", typed: "13062030", iso: "2030-06-13" },
  { label: "Fecha de salida *", button: "Guardar vuelos", section: "service", field: "departureDate", date: "01/03/2027", typed: "02032027", iso: "2027-03-02" },
  { label: "Fecha de llegada", button: "Guardar vuelos", section: "service", field: "arrivalDate", date: "02/03/2027", typed: "03032027", iso: "2027-03-03" },
])("$label permite escribir y seleccionar en calendario y guarda ISO", async ({ label, button, section, field, date, typed, iso }) => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  const populated = { ...sample, requestedAt: "2027-01-05", passengers: [{ passenger: { id: "p-1", firstName: "Ana", lastName: "Viajes", documentType: null, documentNumber: null, birthDate: "1990-06-12", passportNumber: null, passportExpiry: "2030-06-12" } }], services: [{ ...sample.services[0], flightSegments: [{ airline: "LA", origin: "BOG", destination: "LIM", departureDate: "2027-03-01", arrivalDate: "2027-03-02", departureTime: "10:00", arrivalTime: "12:00", cabinClass: "Economía" }] }] };
  const send = vi.fn(async (url: string, init?: RequestInit) => url === "/api/suppliers" ? { ok: true, json: async () => ({ suppliers: [] }) } : init?.method === "PATCH" ? { ok: true, json: async () => ({ version: 3 }) } : { ok: true, json: async () => ({ sale: populated }) });
  vi.stubGlobal("fetch", send);
  render(<SaleOrderDetails saleId="sale-1" saleVersion={2} canEditCommercial canEditOperational canViewFinancial={false} saved={async () => {}} />);
  const input = await screen.findByLabelText(label) as HTMLInputElement;
  expect(input.value).toBe(date);
  fireEvent.change(input, { target: { value: typed } });
  expect(input.value).toBe(`${typed.slice(0, 2)}/${typed.slice(2, 4)}/${typed.slice(4)}`);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(input);
  expect(screen.getByRole("dialog", { name: `Calendario de ${label}` })).toBeTruthy();
  const selectedIso = addDaysIsoDate(iso, 1);
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`\\b${Number(selectedIso.slice(8))} de `, "i") }));
  expect(input.value).toBe(fromIsoDate(selectedIso));
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: button }));
  await waitFor(() => expect(send.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(true));
  const body = JSON.parse(send.mock.calls.find(([, init]) => init?.method === "PATCH")![1]!.body as string);
  expect(body.section).toBe(section);
  expect(section === "people" ? body[field] : section === "passengers" ? body.passengers[0][field] : body.segments[0][field]).toBe(selectedIso);
});

it("rechaza una fecha imposible antes de guardar detalles", async () => {
  const send = vi.fn(async (url: string, _init?: RequestInit) => url === "/api/suppliers" ? { ok: true, json: async () => ({ suppliers: [] }) } : { ok: true, json: async () => ({ sale: sample }) });
  vi.stubGlobal("fetch", send);
  render(<SaleOrderDetails saleId="sale-1" saleVersion={2} canEditCommercial canEditOperational canViewFinancial={false} saved={async () => {}} />);
  const input = await screen.findByLabelText("Fecha de solicitud");
  fireEvent.change(input, { target: { value: "31022027" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar personas y facturación" }));
  expect(screen.getByRole("alert").textContent).toContain("Revisa las fechas");
  expect(send.mock.calls.some(([, init]) => init?.method === "PATCH")).toBe(false);
});
