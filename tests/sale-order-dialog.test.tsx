// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { SaleOrderDialog } from "@/components/sale-order-dialog";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it("confirma un cambio de OS con números anterior/nuevo y motivo sin perder ceros", async () => {
  const send = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ number: "0123" }) });
  const updated = vi.fn(async () => {});
  vi.stubGlobal("fetch", send);
  render(<SaleOrderDialog sale={{ id: "sale-1", number: "VEN-2026-000001", version: 3 }} close={vi.fn()} updated={updated} />);
  fireEvent.change(screen.getByLabelText("Número real de OS *"), { target: { value: "0123" } });
  fireEvent.change(screen.getByLabelText("Motivo *"), { target: { value: "Orden física verificada" } });
  fireEvent.click(screen.getByRole("button", { name: "Revisar cambio" }));
  expect(send).not.toHaveBeenCalled();
  expect(screen.getByText("OS 0123")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Confirmar cambio" }));
  await waitFor(() => expect(updated).toHaveBeenCalledOnce());
  expect(JSON.parse((send.mock.calls[0][1] as RequestInit).body as string)).toEqual({ orderNumber: "0123", version: 3, reason: "Orden física verificada" });
});
