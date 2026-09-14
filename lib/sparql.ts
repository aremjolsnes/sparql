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

/** Hvilken posisjon en ressurs settes inn i når man bygger en `?s ?p ?o`-spørring fra et treff. */
export type TermRole = "subject" | "predicate" | "object";

/**
 * Idé 9 (se Docs/ideer-ai-stotte.md): høyreklikk på en ressurslenke i
 * resultattabellen og bruk den som subjekt/predikat/objekt i en ny spørring.
 * Bruker alltid full IRI i vinkelparenteser – trenger ingen PREFIX-deklarasjon.
 */
export function buildResourceQuery(uri: string, role: TermRole): string {
  const iri = `<${uri}>`;
  const s = role === "subject" ? iri : "?s";
  const p = role === "predicate" ? iri : "?p";
  const o = role === "object" ? iri : "?o";
  return `SELECT * WHERE {\n  ${s} ${p} ${o}\n}\nLIMIT 100`;
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
