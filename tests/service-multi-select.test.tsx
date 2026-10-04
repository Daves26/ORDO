// @vitest-environment jsdom
import { useState } from "react";
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ServiceMultiSelect } from "@/components/service-multi-select";
import type { SaleServiceType } from "@/lib/service-types";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it("permite varios servicios mediante teclado y cierra con Escape", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  function Example() {
    const [selected, setSelected] = useState<SaleServiceType[]>([]);
    return <ServiceMultiSelect selected={selected} onChange={setSelected} />;
  }
  render(<Example />);
  const trigger = screen.getByRole("button", { name: /Servicios incluidos/ });
  fireEvent.click(trigger);
  const flight = screen.getByRole("checkbox", { name: "Vuelos" }) as HTMLInputElement;
  await waitFor(() => expect(document.activeElement).toBe(flight));
  fireEvent.keyDown(flight, { key: "Enter" });
  expect(flight.checked).toBe(true);
  fireEvent.keyDown(flight, { key: "ArrowDown" });
  const hotel = screen.getByRole("checkbox", { name: "Hotel" }) as HTMLInputElement;
  expect(document.activeElement).toBe(hotel);
  fireEvent.click(hotel);
  expect(hotel.checked).toBe(true);
  fireEvent.keyDown(hotel, { key: "Escape" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  expect(trigger.textContent).toContain("Vuelos, Hotel");
});
