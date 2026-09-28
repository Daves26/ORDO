/** Keep the externally assigned number as text so leading zeroes are not lost. */
export function normalizeReceiptNumber(value: string) {
  return value.trim();
}
