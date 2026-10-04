"use client";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { date, money } from "@/lib/format";
import { serviceLabel } from "@/lib/service-types";

type Person = { id: string; firstName: string; lastName: string; documentType: string | null; documentNumber: string | null; birthDate: string | null; passportNumber: string | null; passportExpiry: string | null };
type Segment = { airline: string; departureDate: string; arrivalDate: string; origin: string; destination: string; departureTime: string; arrivalTime: string; cabinClass: string };
type Service = { id: string; type: string; route: string | null; planType: string | null; baggage: string | null; transportCompany: string | null; hotelName: string | null; supplierId: string | null; supplier: { name: string } | null; flightSegments: Segment[] };
type Price = { category: "ADULTO" | "NINO" | "INFANTE"; quantity: number; unitPrice: number | string };
type Order = { id: string; version: number; number: string; total?: string; customerDueAt?: string | null; requestedAt: string | null; contactName: string | null; holderName: string | null;
  billingName: string | null; billingDocument: string | null; billingPhone: string | null; billingAddress: string | null; billingCity: string | null;
  customer: { firstName: string; lastName: string; documentNumber: string | null; phone: string; address: string | null; city: string | null; billingName: string | null; billingDocument: string | null };
  passengers: { passenger: Person }[]; services: Service[]; priceLines?: Price[] };
const blankPassenger = (): Person => ({ id: "", firstName: "", lastName: "", documentType: null, documentNumber: null, birthDate: "", passportNumber: null, passportExpiry: "" });
const blankSegment = (): Segment => ({ airline: "", departureDate: "", arrivalDate: "", origin: "", destination: "", departureTime: "", arrivalTime: "", cabinClass: "" });
const iso = (value: string | null | undefined) => value?.slice(0, 10) ?? "";
const safeError = (result: { error?: string; details?: { fieldErrors?: Record<string, string[]> } }) => result.details?.fieldErrors ? Object.values(result.details.fieldErrors).flat().join(" · ") || result.error : result.error;

export function SaleOrderDetails({ saleId, saleVersion, canEditCommercial, canEditOperational, canViewFinancial, saved }: {
  saleId: string; saleVersion: number; canEditCommercial: boolean; canEditOperational: boolean; canViewFinancial: boolean; saved: () => Promise<void>;
}) {
  const [sale, setSale] = useState<Order | null>(null);
  const [suppliers, setSuppliers] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    const response = await fetch(`/api/sales/${saleId}/order-details`);
    if (!response.ok) { setError("No fue posible cargar los detalles de la orden."); return; }
    setSale((await response.json()).sale);
  }, [saleId]);
  useEffect(() => { void load(); void fetch("/api/suppliers").then((res) => res.ok ? res.json() : { suppliers: [] }).then((data) => setSuppliers(data.suppliers)).catch(() => {}); }, [load]);
  useEffect(() => { if (sale && saleVersion > sale.version) void load(); }, [sale, saleVersion, load]);
  async function save(section: string, fields: object) {
    if (!sale) return false;
    setError("");
    try {
      const response = await fetch(`/api/sales/${saleId}/order-details`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ section, version: sale.version, ...fields }) });
      const result = await response.json();
      if (!response.ok) { setError(safeError(result) ?? "No se pudieron guardar los cambios."); return false; }
      await Promise.all([load(), saved()]);
      return true;
    } catch { setError("No se pudo confirmar el guardado. Recarga el expediente antes de reintentar."); return false; }
  }
  async function createSupplier(name: string) {
    const response = await fetch("/api/suppliers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name }) });
    const result = await response.json();
    if (!response.ok) { setError(result.error ?? "No se pudo crear el proveedor."); return null; }
    setSuppliers((old) => [...old, result.supplier].sort((a, b) => a.name.localeCompare(b.name)));
    return result.supplier as { id: string; name: string };
  }
  if (!sale) return <section className="card" style={{ marginTop: 20 }}><h2>Datos de la orden de servicio</h2><p role="status" className="muted">{error || "Cargando detalles…"}</p></section>;
  return <section className="card" style={{ marginTop: 20 }} aria-labelledby="order-details-title">
    <div className="page-heading"><div><span className="eyebrow">Formato físico · OS {sale.number}</span><h2 id="order-details-title">Datos de la orden de servicio</h2></div></div>
    <p className="muted small">N.º RSVA: los localizadores de esta OS · Plazo RSVA: {date(sale.customerDueAt ?? null)} · IN/OUT: salida y regreso del viaje. No es necesario volver a capturarlos.</p>
    {error && <p className="notice error" role="alert">{error}</p>}
    <PeopleSection key={`people-${sale.version}`} sale={sale} editable={canEditCommercial} save={(fields) => save("people", fields)} />
    <PassengerSection key={`passengers-${sale.version}`} passengers={sale.passengers.map(({ passenger }) => passenger)} editable={canEditOperational} save={(passengers) => save("passengers", { passengers })} />
    <h3 style={{ marginTop: 30 }}>Servicios y emitido por</h3>
    {sale.services.map((service) => <ServiceSection key={`${service.id}-${sale.version}`} service={service} suppliers={suppliers} editable={canEditOperational} save={(fields) => save("service", { serviceId: service.id, ...fields })} createSupplier={createSupplier} />)}
    {canViewFinancial && <PriceSection key={`prices-${sale.version}`} prices={sale.priceLines ?? []} total={Number(sale.total)} editable={canEditCommercial} save={(lines) => save("prices", { lines })} />}
  </section>;
}

function PeopleSection({ sale, editable, save }: { sale: Order; editable: boolean; save: (fields: object) => Promise<boolean> }) {
  const customerName = `${sale.customer.firstName} ${sale.customer.lastName}`;
  const [fields, setFields] = useState({ requestedAt: iso(sale.requestedAt), contactName: sale.contactName ?? "", holderName: sale.holderName ?? "",
    billingName: sale.billingName ?? "", billingDocument: sale.billingDocument ?? "", billingPhone: sale.billingPhone ?? "", billingAddress: sale.billingAddress ?? "", billingCity: sale.billingCity ?? "" });
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); await save(fields); setBusy(false); }
  return <form onSubmit={submit}><h3>Contacto, titular y facturación</h3><p className="muted small">Cliente: {customerName}. Deja los campos de facturación vacíos si son iguales a su ficha; lo emitido conserva una copia de estos datos.</p>
    <div className="form-grid">
      <div className="field"><label htmlFor="os-requested">Fecha de solicitud</label><input id="os-requested" type="date" value={fields.requestedAt} onChange={(event) => setFields({ ...fields, requestedAt: event.target.value })} disabled={!editable || busy} /></div>
      {([ ["contactName", "Contacto", customerName], ["holderName", "Titular de la reserva", customerName], ["billingName", "Facturar a", sale.customer.billingName ?? customerName],
        ["billingDocument", "NIT o CC para facturación", sale.customer.billingDocument ?? sale.customer.documentNumber ?? ""], ["billingPhone", "Teléfono de facturación", sale.customer.phone],
        ["billingAddress", "Dirección de facturación", sale.customer.address ?? ""], ["billingCity", "Ciudad de facturación", sale.customer.city ?? ""] ] as const).map(([key, label, fallback]) => <div className="field" key={key}>
        <label htmlFor={`os-${key}`}>{label}</label><input id={`os-${key}`} value={fields[key]} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} placeholder={fallback} maxLength={key === "billingAddress" ? 200 : 150} disabled={!editable || busy} /></div>)}
    </div>{editable && <div className="form-actions"><button className="btn" disabled={busy}>{busy ? "Guardando…" : "Guardar personas y facturación"}</button></div>}
  </form>;
}

function PassengerSection({ passengers, editable, save }: { passengers: Person[]; editable: boolean; save: (items: object[]) => Promise<boolean> }) {
  const [items, setItems] = useState<Person[]>(passengers.map((person) => ({ ...person, birthDate: iso(person.birthDate), passportExpiry: iso(person.passportExpiry) })));
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); await save(items.map((item) => ({ ...item, id: item.id || undefined }))); setBusy(false); }
  return <form onSubmit={submit} style={{ marginTop: 28, borderTop: "1px solid var(--border)", paddingTop: 16 }}><h3>Datos de los pasajeros</h3>
    <p className="muted small">Un pasajero con el mismo tipo y número de documento se reutiliza entre órdenes. El comprador no se agrega automáticamente como pasajero.</p>
    {items.map((item, index) => <fieldset key={item.id || `nuevo-${index}`} disabled={!editable || busy} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginTop: 12 }}>
      <legend>Pasajero {index + 1}</legend><div className="form-grid">
        {([ ["firstName", "Nombres *"], ["lastName", "Apellidos *"], ["documentType", "Tipo de identificación"], ["documentNumber", "Identificación"], ["passportNumber", "N.º de pasaporte"] ] as const).map(([key, label]) => <div className="field" key={key}><label htmlFor={`pass-${key}-${index}`}>{label}</label><input id={`pass-${key}-${index}`} value={item[key] ?? ""} required={key === "firstName" || key === "lastName"} maxLength={100} onChange={(event) => setItems(items.map((entry, i) => i === index ? { ...entry, [key]: event.target.value } : entry))} /></div>)}
        {([ ["birthDate", "Fecha de nacimiento"], ["passportExpiry", "Vencimiento de pasaporte"] ] as const).map(([key, label]) => <div className="field" key={key}><label htmlFor={`pass-${key}-${index}`}>{label}</label><input id={`pass-${key}-${index}`} type="date" value={item[key] ?? ""} onChange={(event) => setItems(items.map((entry, i) => i === index ? { ...entry, [key]: event.target.value } : entry))} /></div>)}
      </div>{editable && <button type="button" className="btn btn-danger" onClick={() => setItems(items.filter((_, i) => i !== index))}>Quitar de la OS</button>}
    </fieldset>)}
    {!items.length && <p className="muted">Todavía no se registraron pasajeros.</p>}
    {editable && <div className="form-actions"><button type="button" className="btn" onClick={() => setItems([...items, blankPassenger()])}>Añadir pasajero</button><button className="btn btn-primary" disabled={busy}>{busy ? "Guardando…" : "Guardar pasajeros"}</button></div>}
  </form>;
}

function ServiceSection({ service, suppliers, editable, save, createSupplier }: { service: Service; suppliers: { id: string; name: string }[]; editable: boolean; save: (fields: object) => Promise<boolean>; createSupplier: (name: string) => Promise<{ id: string; name: string } | null> }) {
  const [fields, setFields] = useState({ supplierId: service.supplierId ?? "", route: service.route ?? "", planType: service.planType ?? "", baggage: service.baggage ?? "", transportCompany: service.transportCompany ?? "", hotelName: service.hotelName ?? "" });
  const [segments, setSegments] = useState<Segment[]>(service.flightSegments.map((item) => ({ ...item, departureDate: iso(item.departureDate), arrivalDate: iso(item.arrivalDate), cabinClass: item.cabinClass ?? "" })));
  const [supplierName, setSupplierName] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); await save({ ...fields, supplierId: fields.supplierId || null, segments }); setBusy(false); }
  return <form onSubmit={submit} style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 16 }}><h4>{serviceLabel(service.type)}</h4>
    <div className="form-grid"><div className="field"><label htmlFor={`supplier-${service.id}`}>Emitido por · proveedor</label><select id={`supplier-${service.id}`} value={fields.supplierId} disabled={!editable || busy} onChange={(event) => setFields({ ...fields, supplierId: event.target.value })}><option value="">Sin proveedor aún</option>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></div>
      {([ ["route", "Ruta", ["VUELO", "TRASLADO", "TOUR", "OTRO"]], ["planType", "Tipo de plan", ["HOTEL", "TOUR", "ASISTENCIA_MEDICA", "OTRO"]], ["baggage", "Equipaje", ["VUELO", "OTRO"]], ["transportCompany", "Empresa de transporte", ["VUELO", "TRASLADO", "OTRO"]], ["hotelName", "Hotel", ["HOTEL", "OTRO"]] ] as const).filter(([, , types]) => types.some((type) => type === service.type)).map(([key, label]) => <div className="field" key={key}><label htmlFor={`${key}-${service.id}`}>{label}</label><input id={`${key}-${service.id}`} value={fields[key]} disabled={!editable || busy} maxLength={200} onChange={(event) => setFields({ ...fields, [key]: event.target.value })} /></div>)}
    </div>
    {editable && <div className="form-grid" style={{ marginTop: 12 }}><div className="field"><label htmlFor={`new-supplier-${service.id}`}>¿Falta el proveedor? Créalo por nombre</label><input id={`new-supplier-${service.id}`} value={supplierName} onChange={(event) => setSupplierName(event.target.value)} maxLength={150} /></div><button type="button" className="btn" style={{ alignSelf: "end" }} disabled={busy || supplierName.trim().length < 2} onClick={async () => { setBusy(true); try { const created = await createSupplier(supplierName); if (created) { setFields({ ...fields, supplierId: created.id }); setSupplierName(""); } } finally { setBusy(false); } }}>Crear proveedor</button></div>}
    {service.type === "VUELO" && <><h4 style={{ marginTop: 20 }}>Horario de vuelos · tramos</h4>{segments.map((segment, index) => <fieldset key={index} disabled={!editable || busy} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: 14, marginTop: 12 }}><legend>Tramo {index + 1}</legend><div className="form-grid">
      {([ ["airline", "Aerolínea *"], ["origin", "Origen *"], ["destination", "Destino *"], ["departureDate", "Fecha de salida *"], ["departureTime", "Hora de salida *"], ["arrivalDate", "Fecha de llegada"], ["arrivalTime", "Hora de llegada *"], ["cabinClass", "Clase"] ] as const).map(([key, label]) => <div className="field" key={key}><label htmlFor={`flight-${key}-${service.id}-${index}`}>{label}</label><input id={`flight-${key}-${service.id}-${index}`} type={key.includes("Date") ? "date" : key.includes("Time") ? "time" : "text"} required={label.endsWith("*")} value={segment[key]} onChange={(event) => setSegments(segments.map((entry, i) => i === index ? { ...entry, [key]: event.target.value } : entry))} /></div>)}
    </div>{editable && <button type="button" className="btn btn-danger" onClick={() => setSegments(segments.filter((_, i) => i !== index))}>Quitar tramo</button>}</fieldset>)}
      {editable && <button type="button" className="btn" style={{ marginTop: 12 }} onClick={() => setSegments([...segments, blankSegment()])}>Añadir tramo de vuelo</button>}
    </>}
    {editable && <div className="form-actions"><button className="btn btn-primary" disabled={busy}>{busy ? "Guardando…" : `Guardar ${serviceLabel(service.type).toLowerCase()}`}</button></div>}
  </form>;
}

const categories = [["ADULTO", "Adulto"], ["NINO", "Niño"], ["INFANTE", "Infante"]] as const;
function PriceSection({ prices, total, editable, save }: { prices: Price[]; total: number; editable: boolean; save: (lines: Price[]) => Promise<boolean> }) {
  const [fields, setFields] = useState<Record<Price["category"], { quantity: string; unitPrice: string }>>(() => Object.fromEntries(categories.map(([category]) => {
    const price = prices.find((item) => item.category === category);
    return [category, { quantity: price ? String(price.quantity) : "", unitPrice: price ? String(Number(price.unitPrice)) : "" }];
  })) as Record<Price["category"], { quantity: string; unitPrice: string }>);
  const [busy, setBusy] = useState(false);
  const lines = categories.filter(([category]) => fields[category].quantity || fields[category].unitPrice).map(([category]) => ({ category, quantity: Number(fields[category].quantity), unitPrice: Number(fields[category].unitPrice) }));
  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); await save(lines); setBusy(false); }
  return <form onSubmit={submit} style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginTop: 25 }}><h3>Valores por tipo de pasajero · COP</h3><p className="muted small">Precios unitarios informativos. El valor total acordado y los abonos no cambian al editar este desglose.</p><div className="form-grid">
    {categories.map(([category, label]) => <div className="field" key={category} style={{ display: "flex", flexDirection: "column", gap: 8 }}><strong>{label}</strong><label htmlFor={`qty-${category}`}>Cantidad</label><input id={`qty-${category}`} type="number" min="1" max="100" value={fields[category].quantity} onChange={(e) => setFields({ ...fields, [category]: { ...fields[category], quantity: e.target.value } })} disabled={!editable || busy} /><label htmlFor={`price-${category}`}>Precio unitario · COP</label><input id={`price-${category}`} type="number" min="0" step="1" value={fields[category].unitPrice} onChange={(e) => setFields({ ...fields, [category]: { ...fields[category], unitPrice: e.target.value } })} disabled={!editable || busy} /><span className="muted small">Subtotal: {money(Number(fields[category].quantity) * Number(fields[category].unitPrice))}</span></div>)}
  </div><div className="list-row"><span>Desglose: {money(subtotal)}</span><strong>Total acordado: {money(total)}</strong></div>{lines.length > 0 && subtotal !== total && <p className="notice warning">Diferencia de {money(total - subtotal)} respecto al total acordado. Puede corresponder a otros servicios, cargos o descuentos.</p>}
  {editable && <div className="form-actions"><button className="btn btn-primary" disabled={busy || lines.some((line) => !Number.isInteger(line.quantity) || line.quantity < 1 || !Number.isInteger(line.unitPrice) || line.unitPrice < 0)}>{busy ? "Guardando…" : "Guardar desglose"}</button></div>}
  </form>;
}
