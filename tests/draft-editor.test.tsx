// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DraftEditor } from "@/components/draft-editor";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("actualiza servicios y observaciones existentes en el borrador sin perder los demás datos", async () => {
  const send = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ version: 2 }) });
  vi.stubGlobal("fetch", send);
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { callback(0); return 1; });
  const saved = vi.fn(async () => {});
  render(<DraftEditor id="sale-1" saved={saved} sale={{ version: 1, destination: "Cancún", notes: "Hotel inicial", services: [{ id: "service-1", type: "HOTEL" }], startsAt: null, endsAt: null, customerDueAt: null, total: "8000000" }} />);
  fireEvent.click(screen.getByRole("button", { name: /Servicios incluidos/ }));
  fireEvent.click(screen.getByRole("checkbox", { name: "Traslados" }));
  fireEvent.change(screen.getByLabelText("Observaciones de la orden de servicio"), { target: { value: "Hotel con traslados." } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar borrador" }));
  await waitFor(() => expect(send).toHaveBeenCalledOnce());
  expect(JSON.parse((send.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({ version: 1, notes: "Hotel con traslados.", services: ["HOTEL", "TRASLADO"], total: 8_000_000 });
  await waitFor(() => expect(saved).toHaveBeenCalledOnce());
});
