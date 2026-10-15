const currencyFormatter = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const dateFormatter = new Intl.DateTimeFormat("es-CO", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

export const money = (value: number | string) => currencyFormatter.format(Number(value));
export const date = (value: string | Date | null) => value ? dateFormatter.format(new Date(value)) : "Por definir";
