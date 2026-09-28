export const isOrderNumber = (number: string) => /^[0-9]{4}$/.test(number);

/** Legacy VEN identifiers remain visible until accounting assigns their actual OS. */
export function saleLabel(number: string) {
  return isOrderNumber(number) ? `OS ${number}` : `OS pendiente · ${number}`;
}

export function saleSearchNumber(query: string) {
  return /^OS\s*[0-9]{1,4}$/i.test(query) ? query.replace(/^OS\s*/i, "") : query;
}
