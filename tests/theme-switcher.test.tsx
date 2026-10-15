// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ThemeSwitcher } from "@/components/theme-switcher";

let systemDark = false;
let notify: (() => void) | undefined;
beforeEach(() => {
  localStorage.clear();
  document.documentElement.removeAttribute("data-theme");
  document.querySelector('meta[name="theme-color"]')?.remove();
  const meta = document.createElement("meta"); meta.name = "theme-color"; document.head.append(meta);
  systemDark = false; notify = undefined;
  vi.stubGlobal("matchMedia", vi.fn(() => ({ get matches() { return systemDark; }, addEventListener: (_: string, callback: () => void) => { notify = callback; }, removeEventListener: () => {} })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.querySelector('meta[name="theme-color"]')?.remove(); });

it("respeta el sistema y actualiza el tema cuando cambia su preferencia", () => {
  systemDark = true;
  render(<ThemeSwitcher />);
  expect(screen.getByRole("button", { name: "Apariencia: Sistema" })).toBeTruthy();
  expect(document.documentElement.dataset.theme).toBe("dark");
  expect(document.querySelector('meta[name="theme-color"]')?.getAttribute("content")).toBe("#0b1220");
  systemDark = false; notify?.();
  expect(document.documentElement.dataset.theme).toBe("light");
});

it("guarda la elección manual y no la sobrescribe un cambio del sistema", () => {
  render(<ThemeSwitcher />);
  fireEvent.click(screen.getByRole("button", { name: "Apariencia: Sistema" }));
  expect(screen.getByRole("button", { name: "Sistema" }).getAttribute("aria-pressed")).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "Oscuro" }));
  expect(localStorage.getItem("ordo-theme")).toBe("dark");
  expect(document.documentElement.dataset.theme).toBe("dark");
  systemDark = true; notify?.(); systemDark = false; notify?.();
  expect(document.documentElement.dataset.theme).toBe("dark");
  fireEvent.click(screen.getByRole("button", { name: "Apariencia: Oscuro" }));
  fireEvent.click(screen.getByRole("button", { name: "Sistema" }));
  expect(document.documentElement.dataset.theme).toBe("light");
});

it("recupera la preferencia guardada al montar el selector", () => {
  localStorage.setItem("ordo-theme", "dark");
  render(<ThemeSwitcher />);
  expect(screen.getByRole("button", { name: "Apariencia: Oscuro" })).toBeTruthy();
  expect(document.documentElement.dataset.theme).toBe("dark");
});

it("abre un menú compacto y permite cerrarlo con Escape o clic fuera", () => {
  render(<ThemeSwitcher />);
  const trigger = screen.getByRole("button", { name: "Apariencia: Sistema" });
  fireEvent.click(trigger);
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByRole("group", { name: "Seleccionar apariencia" })).toBeTruthy();
  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Sistema" }));
  fireEvent.keyDown(screen.getByRole("button", { name: "Sistema" }), { key: "Escape" });
  expect(screen.queryByRole("group", { name: "Seleccionar apariencia" })).toBeNull();
  expect(document.activeElement).toBe(trigger);
  fireEvent.click(trigger);
  fireEvent.pointerDown(document.body);
  expect(screen.queryByRole("group", { name: "Seleccionar apariencia" })).toBeNull();
});
