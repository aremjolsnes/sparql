/** SPARQL 1.1 Query Results JSON Format. */
export type SparqlTerm = {
  type: "uri" | "literal" | "bnode" | "typed-literal";
  value: string;
  "xml:lang"?: string;
  datatype?: string;
};

export type SparqlResults = {
  head: { vars?: string[]; link?: string[] };
  results?: { bindings: Record<string, SparqlTerm>[] };
  /** ASK-spørringer */
  boolean?: boolean;
};

/**
 * Sjekker om spørringen har en egen LIMIT på ytterste nivå. Enkel heuristikk:
 * en LIMIT som ikke står inne i en gruppe (`{ ... }`). Godt nok til å avgjøre
 * om vi skal legge på en backstop-LIMIT.
 */
export function hasOuterLimit(query: string): boolean {
  const stripped = query
    .replace(/<[^>]*>/g, " ")
    .replace(/"""[\s\S]*?"""/g, " ")
    .replace(/'''[\s\S]*?'''/g, " ")
    .replace(/"(?:\\.|[^"\\])*"/g, " ")
    .replace(/'(?:\\.|[^'\\])*'/g, " ")
    .replace(/#[^\n]*/g, " ");

  let depth = 0;
  const re = /[{}]|(\bLIMIT\b\s+\d+)/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    if (m[0] === "{") depth++;
    else if (m[0] === "}") depth = Math.max(0, depth - 1);
    else if (m[1] && depth === 0) return true;
  }
  return false;
}

/** Legger på `LIMIT n` hvis spørringen ikke selv har en ytterste LIMIT. */
export function applyRowCap(query: string, cap: number): { query: string; capApplied: boolean } {
  if (hasOuterLimit(query)) return { query, capApplied: false };
  return { query: `${query.trimEnd()}\nLIMIT ${cap}`, capApplied: true };
}

/** Kolonnene i et resultat, i riktig rekkefølge. */
export function resultVars(data: SparqlResults): string[] {
  if (data.head?.vars?.length) return data.head.vars;
  // Fallback: utled fra første rad
  const first = data.results?.bindings?.[0];
  return first ? Object.keys(first) : [];
}

/** Kort, lesbar celleverdi (uten språktagg/datatype-pynt). */
export function termText(term: SparqlTerm | undefined): string {
  return term?.value ?? "";
}

const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/** CSV-escaping med vern mot formel-injeksjon i regneark. */
function csvCell(value: string): string {
  let v = value;
  if (FORMULA_PREFIX.test(v)) v = "'" + v;
  if (/[",\n\r]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
  return v;
}

/** Bygger CSV fra hele resultatsettet. */
export function toCsv(vars: string[], bindings: Record<string, SparqlTerm>[]): string {
  const lines = [vars.map(csvCell).join(",")];
  for (const row of bindings) {
    lines.push(vars.map((v) => csvCell(row[v]?.value ?? "")).join(","));
  }
  return lines.join("\r\n");
}
