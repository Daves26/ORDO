// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CustomerPicker } from "@/components/customer-picker";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("permite elegir un cliente con flechas y Enter sin usar mouse", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ customers: [
    { id: "1", firstName: "Juan", lastName: "Pérez", documentType: "CC", documentNumber: "123", phone: "3001234567" },
    { id: "2", firstName: "Juan", lastName: "Gómez", documentType: "CC", documentNumber: "456", phone: "3150000000" },
  ] }) }));
  const onSelect = vi.fn();
  render(<CustomerPicker selected={null} onSelect={onSelect} />);
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: "Jua" } });
  await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));
  fireEvent.keyDown(input, { key: "ArrowDown" });
  expect(screen.getAllByRole("option")[1].getAttribute("aria-selected")).toBe("true");
  fireEvent.keyDown(input, { key: "Enter" });
  expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "2", lastName: "Gómez" }));
});

it("Escape cierra las sugerencias sin modificar la selección", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ customers: [{ id: "1", firstName: "Ana", lastName: "Ruiz", documentType: null, documentNumber: null, phone: "3001234567" }] }) }));
  const onSelect = vi.fn();
  render(<CustomerPicker selected={null} onSelect={onSelect} />);
  const input = screen.getByRole("combobox");
  fireEvent.change(input, { target: { value: "Ana" } });
  await waitFor(() => expect(screen.getByRole("listbox")).toBeTruthy());
  fireEvent.keyDown(input, { key: "Escape" });
  expect(input.getAttribute("aria-expanded")).toBe("false");
  expect(onSelect).not.toHaveBeenCalled();
});
