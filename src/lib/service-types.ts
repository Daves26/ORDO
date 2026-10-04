export const SERVICE_OPTIONS = [
  { code: "VUELO", label: "Vuelos" },
  { code: "HOTEL", label: "Hotel" },
  { code: "TRASLADO", label: "Traslados" },
  { code: "ASISTENCIA_MEDICA", label: "Asistencia médica" },
  { code: "TOUR", label: "Tours" },
  { code: "OTRO", label: "Otro" },
] as const;

export type SaleServiceType = (typeof SERVICE_OPTIONS)[number]["code"];

export function isSaleServiceType(value: string): value is SaleServiceType {
  return SERVICE_OPTIONS.some((option) => option.code === value);
}

export function serviceLabel(code: string) {
  return SERVICE_OPTIONS.find((option) => option.code === code)?.label ?? code.replaceAll("_", " ");
}
