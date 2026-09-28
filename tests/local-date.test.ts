import { expect, it } from "vitest";
import { formatDateInput, fromIsoDate, toIsoDate } from "@/lib/local-date";

it("muestra DD/MM/AAAA, acepta ocho dígitos y envía ISO sin zona horaria", () => {
  expect(formatDateInput("15112026")).toBe("15/11/2026");
  expect(formatDateInput("15/11/2026")).toBe("15/11/2026");
  expect(toIsoDate("15/11/2026")).toBe("2026-11-15");
  expect(fromIsoDate("2026-11-15T00:00:00.000Z")).toBe("15/11/2026");
  expect(toIsoDate("29/02/2028")).toBe("2028-02-29");
});

it("rechaza fechas imposibles o ambiguas", () => {
  expect(toIsoDate("31/02/2026")).toBeNull();
  expect(toIsoDate("29/02/2026")).toBeNull();
  expect(toIsoDate("15/13/2026")).toBeNull();
  expect(toIsoDate("2026-11-15")).toBeNull();
  expect(toIsoDate("15/11/26")).toBeNull();
});
