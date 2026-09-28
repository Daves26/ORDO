// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const navigation = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => navigation }));
import { CustomerEditor } from "@/components/customer-editor";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); navigation.refresh.mockReset(); });

it("formatea nombres y ciudades en edición, pero no reescribe datos que no se tocaron", async () => {
  const send = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ customer: {} }) });
  vi.stubGlobal("fetch", send);
  render(<CustomerEditor id="cliente" initial={{ version: 4, firstName: "Juan", lastName: "McDonald", phone: "3001234567", email: "juan@example.com", documentType: "CC", documentNumber: "123", city: "La Ceja", address: "" }} />);
  fireEvent.click(screen.getByRole("button", { name: "Editar datos" }));
  const lastName = screen.getByLabelText("Apellidos *") as HTMLInputElement;
  fireEvent.change(lastName, { target: { value: "de la cRUZ" } });
  expect(lastName.value).toBe("de la Cruz");
  const city = screen.getByLabelText("Ciudad") as HTMLInputElement;
  fireEvent.change(city, { target: { value: "la ceJA" } });
  expect(city.value).toBe("La Ceja");
  fireEvent.change(screen.getByLabelText("Teléfono *"), { target: { value: "3150000000" } });
  fireEvent.submit(screen.getByRole("button", { name: "Guardar cambios" }).closest("form")!);
  await waitFor(() => expect(send).toHaveBeenCalledOnce());
  const data = JSON.parse((send.mock.calls[0][1] as RequestInit).body as string);
  expect(data).toEqual({ version: 4, lastName: "de la Cruz", phone: "3150000000" });
});
