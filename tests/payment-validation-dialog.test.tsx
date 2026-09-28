// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PaymentValidationDialog } from "@/components/payment-validation-dialog";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

const props = { payment: { id: "payment-1", amount: "2000000", version: 1 }, saleNumber: "OS 0123", customerName: "Juan Pérez", close: vi.fn(), validated: vi.fn(async () => {}) };

it("muestra monto y RC antes de confirmar, envía el RC normalizado una sola vez y permite corregirlo", async () => {
  const send = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "VALIDADO" }) });
  vi.stubGlobal("fetch", send);
  render(<PaymentValidationDialog {...props} />);
  expect(screen.getByRole("dialog").getAttribute("aria-modal")).toBe("true");
  expect(screen.getByText(/2\.000\.000/)).toBeTruthy();
  fireEvent.change(screen.getByLabelText("Número de recibo de caja *"), { target: { value: "00027" } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar validación" }));
  expect(screen.getByText("00027")).toBeTruthy();
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Corregir RC" }));
  expect(send).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Revisar validación" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar validación" }));
  await waitFor(() => expect(props.validated).toHaveBeenCalledOnce());
  expect(send).toHaveBeenCalledOnce();
  expect(JSON.parse((send.mock.calls[0][1] as RequestInit).body as string)).toEqual({ action: "VALIDAR", receiptNumber: "00027", version: 1 });
});

it("cancelar o usar Escape no valida el pago", () => {
  const send = vi.fn();
  vi.stubGlobal("fetch", send);
  const close = vi.fn();
  render(<PaymentValidationDialog {...props} close={close} />);
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(close).toHaveBeenCalledOnce();
  expect(send).not.toHaveBeenCalled();
});

it("mantiene el diálogo abierto y explica cuando el RC ya está utilizado", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 409, json: async () => ({ error: "Este número de RC ya está asociado a otro abono." }) }));
  render(<PaymentValidationDialog {...props} />);
  fireEvent.change(screen.getByLabelText("Número de recibo de caja *"), { target: { value: "00027" } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar validación" }));
  fireEvent.click(screen.getByRole("button", { name: "Confirmar validación" }));
  await screen.findByRole("alert");
  expect(screen.getByText("Este número de RC ya está asociado a otro abono.")).toBeTruthy();
  expect(props.validated).not.toHaveBeenCalled();
});
