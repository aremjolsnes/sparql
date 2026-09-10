/** Faste prefikser i Grep som appen kjenner. */
export const FIXED_PREFIXES: Record<string, string> = {
  d: "http://psi.udir.no/kl06/",
  u: "http://psi.udir.no/ontologi/kl06/",
  st: "https://data.udir.no/kl06/v201906/status/status_",
  rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  rdfs: "http://www.w3.org/2000/01/rdf-schema#",
  xsd: "http://www.w3.org/2001/XMLSchema#",
};

/**
 * Fjerner strenger, IRI-er og kommentarer fra en spørring slik at vi kan lete etter
 * prefiks-tokens uten å treffe noe som står inne i en literal.
 */
function stripLiterals(query: string): string {
  return query
    .replace(/<[^>]*>/g, " ") // IRI-er
    .replace(/"""[\s\S]*?"""/g, " ") // trippel-hermetegn
    .replace(/'''[\s\S]*?'''/g, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, " ") // vanlige strenger
    .replace(/'(?:\\.|[^'\\])*'/g, " ")
    .replace(/#[^\n]*/g, " "); // linjekommentarer
}

/** Finner prefikser som allerede er deklarert med en PREFIX-linje. */
function declaredPrefixes(query: string): Set<string> {
  const set = new Set<string>();
  const re = /\bPREFIX\s+([A-Za-z][\w.-]*)\s*:/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(query)) !== null) set.add(m[1]);
  return set;
}

/** Finner prefiks-tokens (`u:` osv.) som er i bruk i spørringen. */
function usedPrefixes(strippedQuery: string): Set<string> {
  const set = new Set<string>();
  // prefiks:lokal-navn – prefikset kan være tomt (":foo"), men det bryr vi oss ikke om her
  const re = /(?:^|[^\w.-])([A-Za-z][\w.-]*):(?:[\w./%-]|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(strippedQuery)) !== null) set.add(m[1]);
  return set;
}

export type PrefixResult = {
  /** Spørringen med manglende PREFIX-linjer satt inn øverst. */
  query: string;
  /** Prefiksene som ble lagt til. */
  added: string[];
};

/**
 * Setter inn PREFIX-linjer for faste prefikser som brukes i spørringen, men som
 * ikke allerede er deklarert. Brukerens egne prefikser røres ikke.
 */
export function ensurePrefixes(query: string): PrefixResult {
  const stripped = stripLiterals(query);
  const declared = declaredPrefixes(query);
  const used = usedPrefixes(stripped);

  const missing = Object.keys(FIXED_PREFIXES).filter(
    (p) => used.has(p) && !declared.has(p),
  );

  if (missing.length === 0) return { query, added: [] };

  const lines = missing.map((p) => `PREFIX ${p}: <${FIXED_PREFIXES[p]}>`);
  return {
    query: `${lines.join("\n")}\n${query}`,
    added: missing,
  };
}
