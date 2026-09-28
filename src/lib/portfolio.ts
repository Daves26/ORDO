export type PaymentInput = { amount: { toString(): string }; status: string };
export function portfolio(total: number, payments: PaymentInput[], dueAt: Date | null, today: string) {
  const validated = payments.filter((p) => p.status === "VALIDADO").reduce((sum, p) => sum + Number(p.amount), 0);
  const pending = payments.filter((p) => p.status === "REPORTADO").reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = total - validated;
  const status = balance === 0 ? "PAGADA" : dueAt && dueAt.toISOString().slice(0, 10) < today ? "VENCIDA" : validated > 0 ? "PARCIAL" : pending > 0 ? "PENDIENTE_VALIDACION" : "SIN_PAGO";
  return { validated, pending, balance, projectedBalance: balance - pending, status };
}
