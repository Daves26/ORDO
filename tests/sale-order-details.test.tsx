// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SaleOrderDetails } from "@/components/sale-order-details";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const sample = { id: "sale-1", number: "0123", version: 2, requestedAt: null, contactName: null, holderName: null,
  billingName: null, billingDocument: null, billingPhone: null, billingAddress: null, billingCity: null,
  customer: { firstName: "Ana", lastName: "Viajes", documentNumber: "123", phone: "3001234567", address: null, city: null, billingName: null, billingDocument: null },
  passengers: [], services: [{ id: "service-1", type: "VUELO", route: null, planType: null, baggage: null, transportCompany: null, hotelName: null, supplierId: null, supplier: null, flightSegments: [] }],
  priceLines: [{ category: "ADULTO", quantity: 2, unitPrice: "400000" }], total: "1000000", customerDueAt: "2027-02-10", orderIssues: [] };

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
  expect(screen.getByRole("button", { name: "Emitir nueva versión" })).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Contacto"), { target: { value: "María Acosta" } });
  fireEvent.submit(screen.getByRole("button", { name: "Guardar personas y facturación" }).closest("form")!);
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const write = send.mock.calls.find(([, init]) => init?.method === "PATCH")!;
  expect(JSON.parse(write[1]!.body as string)).toMatchObject({ section: "people", version: 2, contactName: "María Acosta" });
});

it("back office edita operación sin ver precios ni emitir un PDF financiero", async () => {
  vi.stubGlobal("fetch", vi.fn(async (url: string) => url === "/api/suppliers" ? { ok: true, json: async () => ({ suppliers: [] }) } : { ok: true, json: async () => ({ sale: { ...sample, total: undefined, priceLines: undefined } }) }));
  render(<SaleOrderDetails saleId="sale-1" saleVersion={2} canEditCommercial={false} canEditOperational canViewFinancial={false} saved={async () => {}} />);
  expect(await screen.findByRole("button", { name: "Añadir tramo de vuelo" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Añadir pasajero" })).toBeTruthy();
  expect(screen.queryByText("Valores por tipo de pasajero · COP")).toBeNull();
  expect(screen.queryByRole("button", { name: "Emitir nueva versión" })).toBeNull();
});
