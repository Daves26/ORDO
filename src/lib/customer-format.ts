const particles = new Set(["de", "del", "la", "las", "los", "y", "da", "do", "dos"]);

/** Capitalization for human-readable customer fields; never use for legal names or identifiers. */
export function formatCustomerText(value: string, kind: "person" | "place" = "person") {
  let wordIndex = 0;
  return value.toLocaleLowerCase("es-CO").replace(/\p{L}+(?:['’\-]\p{L}+)*/gu, (word) => {
    const lower = word.toLocaleLowerCase("es-CO");
    const position = wordIndex++;
    if (particles.has(lower) && (position > 0 || kind === "person")) return lower;
    if (/^mc\p{L}{2,}/u.test(lower)) return `Mc${lower[2].toLocaleUpperCase("es-CO")}${lower.slice(3)}`;
    return lower.replace(/(^|['’\-])(\p{L})/gu, (_, separator: string, letter: string) => separator + letter.toLocaleUpperCase("es-CO"));
  });
}
