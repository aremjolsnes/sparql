import type {
  Binding,
  DiffResult,
  DiffRow,
  MismatchField,
  MismatchSample,
  SparqlResults,
  Term,
} from "./types";

/** Max number of differing rows reported per side, to keep the payload small. */
const MAX_DIFF_ROWS = 50;

export function tryParse(body: string): SparqlResults | null {
  try {
    const j = JSON.parse(body);
    if (j && typeof j === "object") return j as SparqlResults;
    return null;
  } catch {
    return null;
  }
}

export function rowCount(r: SparqlResults | null): number | null {
  if (!r) return null;
  if (typeof r.boolean === "boolean") return null;
  return r.results?.bindings?.length ?? null;
}

const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";

function canonTerm(t: Term): string {
  // Legacy Sesame/GraphDB JSON uses "typed-literal"; RDF 1.1 uses "literal".
  const type = t.type === "typed-literal" ? "literal" : t.type ?? "";
  const lang = t["xml:lang"] ?? "";
  let datatype = t.datatype ?? "";
  // RDF 1.1: a plain string literal and an xsd:string literal are the same term.
  // GraphDB omits the datatype, Jena/Fuseki emits xsd:string — normalise both.
  if (type === "literal" && lang === "" && datatype === XSD_STRING) datatype = "";
  return JSON.stringify([type, t.value ?? "", lang, datatype]);
}

/**
 * A bound-but-empty plain-string literal. GraphDB emits `""` for an empty
 * GROUP_CONCAT / SAMPLE; Jena/Fuseki leaves the variable unbound. Treat the
 * two as equivalent so that difference doesn't flood the diff.
 */
function isEmptyLiteral(t: Term): boolean {
  const type = t.type === "typed-literal" ? "literal" : t.type ?? "";
  return (
    type === "literal" &&
    !t["xml:lang"] &&
    (!t.datatype || t.datatype === XSD_STRING) &&
    (t.value ?? "") === ""
  );
}

/** Canonical, order-independent key for one result row. */
function canonBinding(b: Binding): string {
  const keys = Object.keys(b)
    .filter((k) => !isEmptyLiteral(b[k]))
    .sort();
  return JSON.stringify(keys.map((k) => [k, canonTerm(b[k])]));
}

/** Pair up rows that differ and report which fields actually diverge. */
function fieldDiffs(
  onlyProd: DiffRow[],
  onlyTest: DiffRow[],
  limit: number,
): MismatchSample[] {
  const testPool = onlyTest.map((r) => r.binding);
  const used = new Set<number>();
  const samples: MismatchSample[] = [];

  for (const { binding: p } of onlyProd.slice(0, limit)) {
    // best test row = most fields with an equal .value string
    let bestIdx = -1;
    let bestScore = -1;
    testPool.forEach((t, i) => {
      if (used.has(i)) return;
      let score = 0;
      for (const k of Object.keys(p)) if (t[k]?.value === p[k]?.value) score++;
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    });
    const t = bestIdx >= 0 ? testPool[bestIdx] : null;
    if (bestIdx >= 0) used.add(bestIdx);

    const fields: MismatchField[] = [];
    for (const k of new Set([...Object.keys(p), ...(t ? Object.keys(t) : [])])) {
      const pt = p[k] ?? null;
      const tt = t?.[k] ?? null;
      const pc = pt && !isEmptyLiteral(pt) ? canonTerm(pt) : null;
      const tc = tt && !isEmptyLiteral(tt) ? canonTerm(tt) : null;
      if (pc !== tc) fields.push({ key: k, prod: pt, test: tt });
    }
    if (fields.length) samples.push({ fields });
  }
  return samples;
}

function multiset(bindings: Binding[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const b of bindings) {
    const k = canonBinding(b);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return m;
}

/**
 * Semantic comparison of two SPARQL JSON results.
 * - ASK: compares the boolean.
 * - SELECT: compares head.vars as a set and results.bindings as a multiset
 *   (row order is not significant unless the query has ORDER BY; this diff
 *   is order-independent by design).
 */
export function diffResults(
  prod: SparqlResults | null,
  test: SparqlResults | null,
): DiffResult {
  if (!prod || !test) {
    return {
      comparable: false,
      reason: "Én eller begge responser kunne ikke tolkes som JSON.",
      kind: "unknown",
      equal: false,
    };
  }

  const prodAsk = typeof prod.boolean === "boolean";
  const testAsk = typeof test.boolean === "boolean";

  if (prodAsk || testAsk) {
    if (prodAsk !== testAsk) {
      return {
        comparable: false,
        reason: "Ulik resultattype (ASK mot SELECT).",
        kind: "unknown",
        equal: false,
      };
    }
    const equal = prod.boolean === test.boolean;
    return {
      comparable: true,
      kind: "ask",
      equal,
      ask: { prod: prod.boolean ?? null, test: test.boolean ?? null, equal },
    };
  }

  const prodBindings = prod.results?.bindings;
  const testBindings = test.results?.bindings;
  if (!Array.isArray(prodBindings) || !Array.isArray(testBindings)) {
    return {
      comparable: false,
      reason: "Mangler results.bindings i minst én respons.",
      kind: "unknown",
      equal: false,
    };
  }

  const pv = prod.head?.vars ?? [];
  const tv = test.head?.vars ?? [];
  const pvSet = new Set(pv);
  const tvSet = new Set(tv);
  const onlyInProdVars = pv.filter((v) => !tvSet.has(v));
  const onlyInTestVars = tv.filter((v) => !pvSet.has(v));
  const varsEqual = onlyInProdVars.length === 0 && onlyInTestVars.length === 0;

  const pm = multiset(prodBindings);
  const tm = multiset(testBindings);

  const repProd = new Map<string, Binding>();
  for (const b of prodBindings) {
    const k = canonBinding(b);
    if (!repProd.has(k)) repProd.set(k, b);
  }
  const repTest = new Map<string, Binding>();
  for (const b of testBindings) {
    const k = canonBinding(b);
    if (!repTest.has(k)) repTest.set(k, b);
  }

  const onlyInProd: DiffRow[] = [];
  const onlyInTest: DiffRow[] = [];
  let identical = 0;
  let truncated = false;

  for (const k of new Set<string>([...pm.keys(), ...tm.keys()])) {
    const pc = pm.get(k) ?? 0;
    const tc = tm.get(k) ?? 0;
    identical += Math.min(pc, tc);
    if (pc > tc) {
      if (onlyInProd.length < MAX_DIFF_ROWS) {
        onlyInProd.push({ binding: repProd.get(k)!, count: pc - tc });
      } else {
        truncated = true;
      }
    } else if (tc > pc) {
      if (onlyInTest.length < MAX_DIFF_ROWS) {
        onlyInTest.push({ binding: repTest.get(k)!, count: tc - pc });
      } else {
        truncated = true;
      }
    }
  }

  const rowsEqual =
    onlyInProd.length === 0 && onlyInTest.length === 0 && !truncated;
  const equal =
    varsEqual && rowsEqual && prodBindings.length === testBindings.length;

  return {
    comparable: true,
    kind: "select",
    equal,
    vars: {
      prod: pv,
      test: tv,
      onlyInProd: onlyInProdVars,
      onlyInTest: onlyInTestVars,
      equal: varsEqual,
    },
    rows: {
      prodCount: prodBindings.length,
      testCount: testBindings.length,
      identical,
      onlyInProd,
      onlyInTest,
      truncated,
      mismatchSamples: fieldDiffs(onlyInProd, onlyInTest, 8),
    },
  };
}
