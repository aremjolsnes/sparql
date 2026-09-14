export interface SingleCall {
  ok: boolean;
  httpStatus: number;
  totalMs: number;
  ttfbMs: number | null;
  bytes: number;
  error?: string;
}

export interface NumStats {
  min: number;
  median: number;
  mean: number;
  p95: number;
  max: number;
}

export interface EndpointStats {
  count: number;
  totalMs: NumStats | null;
  ttfbMs: NumStats | null;
  bytes: number | null;
  rowCount: number | null;
  httpStatus: number | null;
  contentType: string | null;
  ok: boolean;
  /** Wall-clock time for the whole measured batch. Only set in load mode. */
  wallMs: number | null;
  /** iterations / wallMs. Only meaningful in load mode. */
  throughputPerSec: number | null;
  /** Fraction of measured calls that failed, 0..1. */
  errorRate: number;
}

export interface EndpointResult {
  url: string;
  cold: SingleCall | null;
  samples: SingleCall[];
  stats: EndpointStats;
  errors: string[];
  bodyPreview: string | null;
  /** Parsed body of the last successful sample. Stripped before sending to the client. */
  parsed: SparqlResults | null;
}

export interface Term {
  type: string;
  value: string;
  "xml:lang"?: string;
  datatype?: string;
}

export type Binding = Record<string, Term>;

export interface SparqlResults {
  head?: { vars?: string[]; link?: string[] };
  results?: { bindings: Binding[] };
  boolean?: boolean;
}

export interface DiffRow {
  binding: Binding;
  count: number;
}

export interface MismatchField {
  key: string;
  prod: Term | null;
  test: Term | null;
}

/** One differing row, paired across the two endpoints, with only the fields that diverge. */
export interface MismatchSample {
  fields: MismatchField[];
}

export interface DiffResult {
  comparable: boolean;
  reason?: string;
  kind: "ask" | "select" | "unknown";
  equal: boolean;
  vars?: {
    prod: string[];
    test: string[];
    onlyInProd: string[];
    onlyInTest: string[];
    equal: boolean;
  };
  ask?: { prod: boolean | null; test: boolean | null; equal: boolean };
  rows?: {
    prodCount: number;
    testCount: number;
    identical: number;
    onlyInProd: DiffRow[];
    onlyInTest: DiffRow[];
    truncated: boolean;
    mismatchSamples: MismatchSample[];
  };
}

export interface RunParams {
  query: string;
  iterations: number;
  warmup: number;
  timeoutMs: number;
  /** >1 fires the measured calls from a pool of this size (load mode). Default 1. */
  concurrency?: number;
}

export interface SavedQuery {
  name: string;
  query: string;
}

export interface BatchItem {
  name: string;
  query: string;
  prodMedianMs: number | null;
  testMedianMs: number | null;
  prodColdMs: number | null;
  testColdMs: number | null;
  prodRows: number | null;
  testRows: number | null;
  diffComparable: boolean;
  diffEqual: boolean;
  diffSummary: string;
  error?: string;
}

export interface BatchReport {
  id: string;
  createdAt: string;
  params: {
    iterations: number;
    warmup: number;
    timeoutMs: number;
    concurrency: number;
  };
  endpoints: { prod: string; test: string };
  items: BatchItem[];
}

export interface BatchReportSummary {
  id: string;
  createdAt: string;
  count: number;
  equal: number;
  differing: number;
  incomparable: number;
}

export interface ComparisonResponse {
  query: string;
  params: {
    iterations: number;
    warmup: number;
    timeoutMs: number;
    concurrency: number;
  };
  endpoints: { prod: string; test: string };
  elapsedMs: number;
  prod: Omit<EndpointResult, "parsed">;
  test: Omit<EndpointResult, "parsed">;
  diff: DiffResult;
}
