// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { DateField } from "@/components/date-field";

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Example() {
  const [value, setValue] = useState("");
  return <DateField id="travel-date" label="Salida" value={value} onChange={setValue} />;
}

it("muestra DD/MM/AAAA mientras se escriben ocho dígitos y advierte fechas imposibles", () => {
  render(<Example />);
  const input = screen.getByLabelText("Salida") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "31112026" } });
  expect(input.value).toBe("31/11/2026");
  fireEvent.blur(input);
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByText("Indica una fecha real en formato DD/MM/AAAA.")).toBeTruthy();
  fireEvent.change(input, { target: { value: "30112026" } });
  expect(input.value).toBe("30/11/2026");
  expect(input.getAttribute("aria-invalid")).toBeNull();
});
