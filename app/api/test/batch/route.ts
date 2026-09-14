import { NextResponse } from "next/server";
import { getEndpoints } from "@/lib/fuseki-test/endpoints";
import { runComparison } from "@/lib/fuseki-test/benchmark";
import { diffResults } from "@/lib/fuseki-test/sparql";
import { listQueries, newReportId, saveReport } from "@/lib/fuseki-test/store";
import type { BatchItem, BatchReport, DiffResult } from "@/lib/fuseki-test/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function toInt(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function diffSummary(d: DiffResult): string {
  if (!d.comparable) return d.reason ?? "ikke sammenlignbar";
  if (d.kind === "ask") return d.equal ? "ASK like" : "ASK ulike";
  if (d.equal) return `${d.rows?.identical ?? 0} rader, like`;
  const p = d.rows?.onlyInProd.length ?? 0;
  const t = d.rows?.onlyInTest.length ?? 0;
  return `avvik: ${p} kun dagens, ${t} kun test`;
}

export async function POST(req: Request) {
  let payload: Record<string, unknown> = {};
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    // empty body = run all with defaults
  }

  const iterations = clamp(toInt(payload.iterations, 3), 1, 50);
  const warmup = clamp(toInt(payload.warmup, 1), 0, 10);
  const timeoutMs = clamp(toInt(payload.timeoutMs, 60000), 1000, 120000);
  const concurrency = clamp(toInt(payload.concurrency, 1), 1, 50);
  const endpoints = getEndpoints(
    payload.endpoints as { prod?: string; test?: string } | undefined,
  );
  const names = Array.isArray(payload.names)
    ? (payload.names as unknown[]).filter(
        (x): x is string => typeof x === "string",
      )
    : null;

  let queries = await listQueries();
  if (names && names.length) {
    const wanted = new Set(names);
    queries = queries.filter((q) => wanted.has(q.name));
  }
  if (!queries.length) {
    return NextResponse.json(
      { error: "Ingen lagrede spørringer å kjøre." },
      { status: 400 },
    );
  }

  const items: BatchItem[] = [];
  for (const q of queries) {
    try {
      const { prod, test } = await runComparison(endpoints, {
        query: q.query,
        iterations,
        warmup,
        timeoutMs,
        concurrency,
      });
      const diff = diffResults(prod.parsed, test.parsed);
      items.push({
        name: q.name,
        query: q.query,
        prodMedianMs: prod.stats.totalMs?.median ?? null,
        testMedianMs: test.stats.totalMs?.median ?? null,
        prodColdMs: prod.cold?.error ? null : prod.cold?.totalMs ?? null,
        testColdMs: test.cold?.error ? null : test.cold?.totalMs ?? null,
        prodRows: prod.stats.rowCount,
        testRows: test.stats.rowCount,
        diffComparable: diff.comparable,
        diffEqual: diff.equal,
        diffSummary: diffSummary(diff),
      });
    } catch (e) {
      items.push({
        name: q.name,
        query: q.query,
        prodMedianMs: null,
        testMedianMs: null,
        prodColdMs: null,
        testColdMs: null,
        prodRows: null,
        testRows: null,
        diffComparable: false,
        diffEqual: false,
        diffSummary: "feilet",
        error: String((e as Error).message ?? e),
      });
    }
  }

  const report: BatchReport = {
    id: newReportId(),
    createdAt: new Date().toISOString(),
    params: { iterations, warmup, timeoutMs, concurrency },
    endpoints,
    items,
  };
  let saved = true;
  try {
    await saveReport(report);
  } catch (e) {
    // Vercel's filesystem is read-only — return the report anyway, just not persisted.
    saved = false;
    const code = (e as { code?: string }).code;
    if (code !== "EROFS" && code !== "EACCES") throw e;
  }
  return NextResponse.json({ ...report, saved });
}
