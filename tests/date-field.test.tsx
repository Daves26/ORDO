// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { DateField } from "@/components/date-field";
import { addDaysIsoDate, toIsoDate } from "@/lib/local-date";

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

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

function TravelDates({ initialStart = "15/11/2026" }: { initialStart?: string }) {
  const [start, setStart] = useState(initialStart);
  const [end, setEnd] = useState("");
  const [calendar, setCalendar] = useState<"start" | "end" | null>(null);
  return <>
    <DateField id="start" label="Salida" value={start} onChange={setStart} calendar calendarOpen={calendar === "start"} onCalendarOpenChange={(open) => setCalendar(open ? "start" : null)} onCalendarSelect={() => setCalendar("end")} />
    <DateField id="end" label="Regreso" value={end} onChange={setEnd} calendar calendarOpen={calendar === "end"} onCalendarOpenChange={(open) => setCalendar(open ? "end" : null)} minIsoDate={toIsoDate(start) ? addDaysIsoDate(toIsoDate(start)!, 1) : undefined} />
  </>;
}

it("el teclado sigue escribiendo DD/MM/AAAA sin abrir el calendario; el clic sí lo abre", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  render(<TravelDates />);
  const start = screen.getByLabelText("Salida") as HTMLInputElement;
  fireEvent.change(start, { target: { value: "15112026" } });
  expect(start.value).toBe("15/11/2026");
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(start);
  expect(screen.getByRole("dialog", { name: "Calendario de Salida" })).toBeTruthy();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  await waitFor(() => expect(document.activeElement).toBe(start));
});

it("al elegir salida abre regreso, deshabilita el mismo día y permite una fecha posterior", async () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  render(<TravelDates />);
  fireEvent.click(screen.getByLabelText("Salida"));
  fireEvent.click(screen.getByRole("button", { name: /15 de noviembre de 2026/i }));
  expect(screen.queryByRole("dialog", { name: "Calendario de Salida" })).toBeNull();
  expect(screen.getByRole("dialog", { name: "Calendario de Regreso" })).toBeTruthy();
  expect((screen.getByRole("button", { name: /15 de noviembre de 2026/i }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: /16 de noviembre de 2026/i }));
  expect((screen.getByLabelText("Regreso") as HTMLInputElement).value).toBe("16/11/2026");
  expect(screen.queryByRole("dialog")).toBeNull();
});

it("al seleccionar salida a fin de año abre regreso en el mes siguiente", () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  render(<TravelDates initialStart="31/12/2026" />);
  fireEvent.click(screen.getByLabelText("Salida"));
  fireEvent.click(screen.getByRole("button", { name: /31 de diciembre de 2026/i }));
  expect(screen.getByRole("dialog", { name: "Calendario de Regreso" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "Mes anterior" }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "viernes, 1 de enero de 2027" }));
  expect((screen.getByLabelText("Regreso") as HTMLInputElement).value).toBe("01/01/2027");
});

it("el campo de pago acepta escritura y selección en el calendario", () => {
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => window.setTimeout(() => callback(0), 0));
  function PaymentDate() {
    const [value, setValue] = useState("10/02/2027");
    return <DateField id="payment-date" label="Pago máximo del cliente" value={value} onChange={setValue} />;
  }
  render(<PaymentDate />);
  const input = screen.getByLabelText("Pago máximo del cliente") as HTMLInputElement;
  fireEvent.change(input, { target: { value: "11022027" } });
  expect(input.value).toBe("11/02/2027");
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(input);
  fireEvent.click(screen.getByRole("button", { name: /12 de febrero de 2027/i }));
  expect(input.value).toBe("12/02/2027");
});

it("no abre el calendario cuando el campo está deshabilitado", () => {
  render(<DateField id="readonly-date" label="Fecha de solicitud" value="" onChange={() => {}} disabled />);
  fireEvent.click(screen.getByLabelText("Fecha de solicitud"));
  expect(screen.queryByRole("dialog")).toBeNull();
});
