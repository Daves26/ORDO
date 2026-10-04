// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SaleLocators, type LocatorItem } from "@/components/sale-locators";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("añade un código preservando su escritura y puede asociarlo opcionalmente a un servicio", async () => {
  const send = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "locator-1" }) });
  const saved = vi.fn(async () => {});
  vi.stubGlobal("fetch", send);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  render(<SaleLocators saleId="sale-1" services={[{ id: "service-1", type: "VUELO", name: "Vuelos" }]} locators={[]} actorId="advisor-1" canEditAll={false} canDelete={false} saved={saved} />);
  fireEvent.click(screen.getByRole("button", { name: "Añadir localizador" }));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Origen *")));
  fireEvent.change(screen.getByLabelText("Emisor"), { target: { value: "Mayorista Norte" } });
  fireEvent.change(screen.getByLabelText("Código o número *"), { target: { value: "0aB-123" } });
  fireEvent.change(screen.getByLabelText("Servicio relacionado"), { target: { value: "service-1" } });
  fireEvent.submit(screen.getByRole("button", { name: "Guardar localizador" }).closest("form")!);
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
  const body = JSON.parse((send.mock.calls[0][1] as RequestInit).body as string);
  expect(body).toMatchObject({ source: "MAYORISTA", issuerName: "Mayorista Norte", code: "0aB-123", serviceId: "service-1" });
  expect(body.requestId).toMatch(/^[a-f\d-]{36}$/i);
});

it("solo muestra la corrección a autor, back office o superusuario", () => {
  const locator: LocatorItem = {
    id: "loc-1", code: "ABC-42", source: "AEROLINEA", issuerName: "Avianca", serviceId: null,
    notes: null, createdById: "advisor-1", createdBy: { name: "Laura" }, createdAt: "2026-10-04T12:00:00.000Z", version: 1, service: null,
  };
  const props = { saleId: "sale-1", services: [], locators: [locator], saved: async () => {}, canDelete: false };
  const current = render(<SaleLocators {...props} actorId="advisor-2" canEditAll={false} />);
  expect(screen.queryByRole("button", { name: "Corregir" })).toBeNull();
  current.rerender(<SaleLocators {...props} actorId="advisor-1" canEditAll={false} />);
  expect(screen.getByRole("button", { name: "Corregir" })).toBeTruthy();
  current.rerender(<SaleLocators {...props} actorId="advisor-2" canEditAll={true} />);
  expect(screen.getByRole("button", { name: "Corregir" })).toBeTruthy();
});
