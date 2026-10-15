export type PassengerView = {
  id: string; firstName: string; lastName: string; documentType: string | null; documentNumber: string | null;
  birthDate: string | null; passportNumber: string | null; passportExpiry: string | null;
};
export type SaleView = {
  sale: {
    id: string; number: string; advisorId: string; destination: string; serviceType: string | null; services: { id: string; type: string; name: string }[];
    notes: string | null; startsAt: string | null; endsAt: string | null; customerDueAt?: string | null;
    total?: string; version: number; commercialStatus: string;
    customer: { id: string; firstName: string; lastName: string };
    advisor: { name: string };
    payments: { id: string; amount: string; version: number; status: string; method: string; paidAt: string; receipt: { number: string } | null; corrections: { previousAmount: string; newAmount: string; createdAt: string; reason: string; actor: { name: string } }[] }[];
    locators: { id: string; code: string; source: "MAYORISTA" | "PROVEEDOR" | "AEROLINEA" | "HOTEL" | "ASISTENCIA_MEDICA" | "OTRO"; issuerName: string | null; serviceId: string | null; notes: string | null; createdById: string; createdBy: { name: string }; createdAt: string; version: number; service: { name: string; type: string } | null }[];
    receipts?: { id: string; number: string; paymentId: string | null }[];
    tasks: { id: string; description: string; status: string; assignedRole: string | null }[];
    passengers: { passenger: PassengerView }[];
  };
  validated: number; pending: number; balance: number; projectedBalance: number; portfolioStatus: string; gaps: string[];
};
