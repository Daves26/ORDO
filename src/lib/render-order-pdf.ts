import PDFDocument from "pdfkit";
import { date, money } from "@/lib/format";
import { serviceLabel } from "@/lib/service-types";

type Passenger = { firstName: string; lastName: string; documentType: string | null; documentNumber: string | null; birthDate: string | null; passportNumber: string | null; passportExpiry: string | null };
type Segment = { airline: string; departureDate: string; arrivalDate: string | null; origin: string; destination: string; departureTime: string; arrivalTime: string; cabinClass: string | null };
type Service = { type: string; route: string | null; planType: string | null; baggage: string | null; transportCompany: string | null; hotelName: string | null; supplier: { name: string } | null; flightSegments: Segment[] };
export type OrderSnapshot = {
  number: string; requestedAt: string | null; contactName: string | null; holderName: string | null;
  billingName: string; billingDocument: string | null; billingPhone: string | null; billingAddress: string | null; billingCity: string | null;
  customer: { name: string; phone: string; email: string | null }; advisor: string; destination: string; notes: string | null;
  startsAt: string | null; endsAt: string | null; customerDueAt: string | null; total: string;
  passengers: Passenger[]; services: Service[]; locators: { code: string; source: string; issuerName: string | null }[];
  priceLines: { category: string; quantity: number; unitPrice: string }[];
  payments: { amount: string; status: string; method: string; paidAt: string; receipt: string | null }[];
  validated: number; reported: number; balance: number;
};

export async function renderOrderPdf(snapshot: OrderSnapshot, issuedAt: Date): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 45, info: { Title: `Orden de servicio ${snapshot.number}`, Author: "ORDO" } });
  const chunks: Buffer[] = [];
  const completed = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  // Helvetica supports Spanish punctuation and accented Latin characters with WinAnsi.
  const safe = (value: unknown) => String(value ?? "-").replace(/[^\u0020-\u00ff\n]/g, "-");
  const line = (label: string, value: unknown) => { doc.font("Helvetica-Bold").text(`${safe(label)}: `, { continued: true }).font("Helvetica").text(safe(value)); };
  const section = (title: string) => {
    if (doc.y > 685) doc.addPage();
    doc.moveDown(0.6).font("Helvetica-Bold").fontSize(12).fillColor("#27377c").text(safe(title));
    doc.moveDown(0.3).fillColor("#1c2540").font("Helvetica").fontSize(10);
  };
  doc.fillColor("#27377c").font("Helvetica-Bold").fontSize(18).text(`ORDEN DE SERVICIO ${safe(snapshot.number)}`);
  doc.fillColor("#1c2540").font("Helvetica").fontSize(10).text(`Emitida: ${date(issuedAt)}  |  Asesor: ${safe(snapshot.advisor)}`);
  section("Solicitud y reserva");
  line("Fecha de solicitud", date(snapshot.requestedAt));
  line("N. RSVA / localizadores", snapshot.locators.length ? snapshot.locators.map((item) => `${item.code} (${item.issuerName || item.source})`).join("; ") : "Pendientes");
  line("Plazo RSVA / pago cliente", date(snapshot.customerDueAt));
  line("Contacto", snapshot.contactName ?? snapshot.customer.name);
  line("Titular de la reserva", snapshot.holderName ?? snapshot.customer.name);
  line("Facturar a", snapshot.billingName);
  line("NIT o CC", snapshot.billingDocument);
  line("Celular", snapshot.customer.phone);
  line("Teléfono de facturación", snapshot.billingPhone);
  line("Dirección", snapshot.billingAddress);
  line("Ciudad", snapshot.billingCity);
  line("E-mail", snapshot.customer.email);
  line("Destino", snapshot.destination);
  line("IN / salida", date(snapshot.startsAt));
  line("OUT / regreso", date(snapshot.endsAt));
  line("Observaciones", snapshot.notes);
  section("Pasajeros");
  if (!snapshot.passengers.length) doc.text("Sin pasajeros registrados.");
  snapshot.passengers.forEach((item, index) => {
    line(`${index + 1}. ${item.firstName} ${item.lastName}`, `${item.documentType ?? "Documento"} ${item.documentNumber ?? "-"}; nacimiento ${date(item.birthDate)}; pasaporte ${item.passportNumber ?? "-"}; vence ${date(item.passportExpiry)}`);
  });
  section("Servicios y emitido por");
  for (const service of snapshot.services) {
    line(serviceLabel(service.type), `Emitido por: ${service.supplier?.name ?? "Pendiente"}`);
    for (const [label, value] of [["Ruta", service.route], ["Tipo de plan", service.planType], ["Equipaje", service.baggage], ["Empresa de transporte", service.transportCompany], ["Hotel", service.hotelName]]) {
      if (value) line(`  ${label}`, value);
    }
    for (const segment of service.flightSegments) {
      line("  Vuelo", `${segment.airline} | ${date(segment.departureDate)} ${segment.origin} ${segment.departureTime} - ${segment.arrivalDate ? date(segment.arrivalDate) : "Fecha de llegada pendiente"} ${segment.destination} ${segment.arrivalTime} | Clase ${segment.cabinClass ?? "-"}`);
    }
  }
  section("Valores por pasajero - COP");
  for (const item of snapshot.priceLines) line(item.category, `${item.quantity} x ${money(item.unitPrice)} = ${money(item.quantity * Number(item.unitPrice))}`);
  const subtotal = snapshot.priceLines.reduce((sum, item) => sum + item.quantity * Number(item.unitPrice), 0);
  if (snapshot.priceLines.length && subtotal !== Number(snapshot.total)) line("Diferencia respecto al total acordado", money(Number(snapshot.total) - subtotal));
  line("Valor total acordado", money(snapshot.total));
  section("Pagos y recibos de caja");
  for (const item of snapshot.payments) line(date(item.paidAt), `${money(item.amount)} | ${item.method} | ${item.status}${item.receipt ? ` | RC ${item.receipt}` : ""}`);
  line("Abonos validados", money(snapshot.validated));
  if (snapshot.reported) line("Abonos reportados pendientes de validar", money(snapshot.reported));
  line("Saldo contable pendiente", money(snapshot.balance));
  line("Fecha máxima de pago", date(snapshot.customerDueAt));
  doc.end();
  return completed;
}
