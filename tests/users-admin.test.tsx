// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
import { UsersAdmin } from "@/components/users-admin";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); router.refresh.mockReset(); });

it("permite al administrador darse otro rol con motivo y refresca sus permisos", async () => {
  const send = vi.fn().mockImplementation(async (url: string, options?: RequestInit) => {
    if (url === "/api/users") return { ok: true, json: async () => ({ users: [{ id: "self", name: "Admin", email: "admin@example.com", active: true, version: 1, roles: [{ role: { code: "ADMINISTRADOR" } }] }] }) };
    if (url === "/api/users/self/roles") return { ok: true, json: async () => ({ user: { id: "self" } }) };
    throw new Error(`Unexpected ${url} ${options?.method}`);
  });
  vi.stubGlobal("fetch", send);
  render(<UsersAdmin ownId="self" />);
  fireEvent.click(await screen.findByRole("button", { name: "Editar roles de Admin" }));
  const checkboxes = screen.getByRole("group", { name: "Roles asignados" });
  fireEvent.click(checkboxes.querySelector('input[value="ASESOR"]')!);
  fireEvent.change(screen.getByLabelText("Motivo del cambio *"), { target: { value: "Nuevas responsabilidades" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar roles" }));
  await waitFor(() => expect(router.refresh).toHaveBeenCalledOnce());
  const call = send.mock.calls.find(([url]) => url === "/api/users/self/roles")!;
  expect(JSON.parse((call[1] as RequestInit).body as string)).toEqual({ version: 1, roles: ["ADMINISTRADOR", "ASESOR"], reason: "Nuevas responsabilidades" });
});
