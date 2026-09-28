// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PaymentAmountDialog } from "@/components/payment-amount-dialog";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("pide motivo y confirma importe previo, importe corregido, saldo y número de recibo sin modificarlo", async () => {
  const send = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ amount: "1500000" }) });
  const updated = vi.fn(async () => {});
  vi.stubGlobal("fetch", send);
  render(<PaymentAmountDialog payment={{ id: "p1", amount: "2000000", status: "VALIDADO", version: 2, receipt: { number: "000123" } }} balance={6000000} projectedBalance={6000000} close={vi.fn()} updated={updated} />);
  fireEvent.change(screen.getByLabelText("Nuevo valor · COP *"), { target: { value: "1500000" } });
  fireEvent.change(screen.getByLabelText("Motivo *"), { target: { value: "Valor contable corregido" } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar corrección" }));
  expect(send).not.toHaveBeenCalled();
  expect(screen.getByText(/5\.000\.000|6\.500\.000/)).toBeTruthy();
  expect(screen.getByText(/conservar el recibo número 000123/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar corrección" }));
  await waitFor(() => expect(updated).toHaveBeenCalledOnce());
  expect(JSON.parse((send.mock.calls[0][1] as RequestInit).body as string)).toEqual({ amount: 1_500_000, version: 2, reason: "Valor contable corregido" });
});

it("cancelar antes de confirmar no envía la corrección", () => {
  const send = vi.fn();
  const close = vi.fn();
  vi.stubGlobal("fetch", send);
  render(<PaymentAmountDialog payment={{ id: "p2", amount: "500000", status: "REPORTADO", version: 1, receipt: null }} balance={1000000} projectedBalance={500000} close={close} updated={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(close).toHaveBeenCalledOnce();
  expect(send).not.toHaveBeenCalled();
});
