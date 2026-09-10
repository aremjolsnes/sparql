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
 * Kjente varianter av en prefiks-verdi som betyr «samme ting» på ulike endepunkter.
 * Beta-repoet bruker `beta-data.udir.no` i status-URI-ene, Prod bruker `data.udir.no`.
 * Når spørringen har en av disse deklarert og det valgte endepunktet vil ha en annen,
 * bytter vi den ut (men vi rører aldri en verdi som ikke står på lista).
 */
export const KNOWN_PREFIX_VARIANTS: Record<string, string[]> = {
  st: [
    "https://data.udir.no/kl06/v201906/status/status_",
    "https://beta-data.udir.no/kl06/v201906/status/status_",
  ],
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

function escapeRe(s: string): string {
  return s.replace(/[-[\]/{}()*+?.\\^$|]/g, "\\$&");
}

export type PrefixResult = {
  /** Spørringen med manglende / justerte PREFIX-linjer. */
  query: string;
  /** Prefikser som ble lagt til. */
  added: string[];
  /** Prefikser der en deklarert verdi ble byttet til endepunktets variant. */
  adjusted: string[];
};

/**
 * - Setter inn PREFIX-linjer for faste prefikser som brukes men ikke er deklarert.
 * - Bytter ut en deklarert prefiks-verdi som er en kjent variant (se
 *   KNOWN_PREFIX_VARIANTS) med den verdien det valgte endepunktet vil ha.
 * Egendefinerte prefiks-verdier røres aldri.
 *
 * @param overrides prefiks-overstyringer for det valgte endepunktet (f.eks. { st: "https://beta-data.udir.no/…" })
 */
export function ensurePrefixes(
  query: string,
  overrides: Record<string, string> = {},
): PrefixResult {
  const effective = { ...FIXED_PREFIXES, ...overrides };
  const added: string[] = [];
  const adjusted: string[] = [];
  let out = query;

  // 1) Bytt ut deklarerte prefikser som er en kjent variant, men ikke den valgte.
  for (const p of Object.keys(KNOWN_PREFIX_VARIANTS)) {
    const want = effective[p];
    if (!want) continue;
    const variants = new Set(KNOWN_PREFIX_VARIANTS[p]);
    const re = new RegExp(`(\\bPREFIX\\s+${escapeRe(p)}\\s*:\\s*)<([^>]*)>`, "i");
    const m = out.match(re);
    if (m && variants.has(m[2]) && m[2] !== want) {
      out = out.replace(re, `$1<${want}>`);
      adjusted.push(p);
    }
  }

  // 2) Sett inn manglende, brukte prefikser.
  const stripped = stripLiterals(out);
  const declared = declaredPrefixes(out);
  const used = usedPrefixes(stripped);
  const missing = Object.keys(effective).filter((p) => used.has(p) && !declared.has(p));
  if (missing.length > 0) {
    const lines = missing.map((p) => `PREFIX ${p}: <${effective[p]}>`);
    out = `${lines.join("\n")}\n${out}`;
    added.push(...missing);
  }

  return { query: out, added, adjusted };
}
