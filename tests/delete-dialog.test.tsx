// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DeleteDialog } from "@/components/delete-dialog";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("muestra el impacto real, exige identificador literal y no envía la eliminación al cancelar", async () => {
  const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ label: "OS 0042", confirmation: "0042", version: 2, fingerprint: "snapshot", details: { ventas: 1, abonos: 2, recibos: 1, documentos: 0 } }) });
  const close = vi.fn(); const deleted = vi.fn(async () => {});
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  render(<DeleteDialog endpoint="/api/sales/sale-1/delete" close={close} deleted={deleted} />);
  expect(await screen.findByText("OS 0042")).toBeTruthy();
  expect(screen.getByText("abonos")).toBeTruthy();
  const button = screen.getByRole("button", { name: "Eliminar definitivamente" }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.change(screen.getByLabelText("Escribe 0042 para confirmar"), { target: { value: "42" } });
  expect(button.disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
  expect(close).toHaveBeenCalledOnce();
  expect(fetcher).toHaveBeenCalledOnce();
  expect(deleted).not.toHaveBeenCalled();
});

it("envía la confirmación y versión del resumen; nunca solicita motivo ni crea bitácora", async () => {
  const fetcher = vi.fn().mockImplementation(async (_url: string, options?: RequestInit) => options?.method === "POST"
    ? { ok: true, json: async () => ({ deleted: true }) }
    : { ok: true, json: async () => ({ label: "OS 0042", confirmation: "0042", version: 2, fingerprint: "snapshot", details: { ventas: 1 } }) });
  const deleted = vi.fn(async () => {});
  vi.stubGlobal("fetch", fetcher);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  render(<DeleteDialog endpoint="/api/sales/sale-1/delete" close={vi.fn()} deleted={deleted} />);
  fireEvent.change(await screen.findByLabelText("Escribe 0042 para confirmar"), { target: { value: "0042" } });
  fireEvent.click(screen.getByRole("button", { name: "Eliminar definitivamente" }));
  await waitFor(() => expect(deleted).toHaveBeenCalledOnce());
  expect(JSON.parse((fetcher.mock.calls[1][1] as RequestInit).body as string)).toEqual({ confirm: "0042", fingerprint: "snapshot" });
});
