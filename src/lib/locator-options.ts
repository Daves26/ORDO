export const LOCATOR_SOURCES = [
  { code: "MAYORISTA", label: "Página de emisión / mayorista" },
  { code: "PROVEEDOR", label: "Proveedor" },
  { code: "AEROLINEA", label: "Aerolínea" },
  { code: "HOTEL", label: "Hotel" },
  { code: "ASISTENCIA_MEDICA", label: "Asistencia médica" },
  { code: "OTRO", label: "Otro" },
] as const;

export type LocatorSourceCode = (typeof LOCATOR_SOURCES)[number]["code"];

export function locatorSourceLabel(value: string) {
  return LOCATOR_SOURCES.find(({ code }) => code === value)?.label ?? value;
}
