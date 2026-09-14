import { NextResponse } from "next/server";
import { getEndpoints } from "@/lib/fuseki-test/endpoints";
import { runComparison } from "@/lib/fuseki-test/benchmark";
import { diffResults } from "@/lib/fuseki-test/sparql";
import type { ComparisonResponse } from "@/lib/fuseki-test/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Vercel caps this; locally it has no effect. A cold Fuseki start can exceed it
// on Vercel — run a warm-up there first, or keep iterations low.
export const maxDuration = 60;

function toInt(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(n) : fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

export async function POST(req: Request) {
  let payload: Record<string, unknown>;
  try {
    payload = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON i forespørselen." }, { status: 400 });
  }

  const query =
    typeof payload.query === "string" ? payload.query.trim() : "";
  if (!query) {
    return NextResponse.json({ error: "Spørringsfeltet er tomt." }, { status: 400 });
  }

  const iterations = clamp(toInt(payload.iterations, 5), 1, 200);
  const warmup = clamp(toInt(payload.warmup, 1), 0, 10);
  const timeoutMs = clamp(toInt(payload.timeoutMs, 60000), 1000, 120000);
  const concurrency = clamp(toInt(payload.concurrency, 1), 1, 50);
  const endpoints = getEndpoints(
    payload.endpoints as { prod?: string; test?: string } | undefined,
  );

  const started = Date.now();
  const { prod, test } = await runComparison(endpoints, {
    query,
    iterations,
    warmup,
    timeoutMs,
    concurrency,
  });
  const diff = diffResults(prod.parsed, test.parsed);

  const { parsed: _p, ...prodWire } = prod;
  const { parsed: _t, ...testWire } = test;

  const body: ComparisonResponse = {
    query,
    params: { iterations, warmup, timeoutMs, concurrency },
    endpoints,
    elapsedMs: Date.now() - started,
    prod: prodWire,
    test: testWire,
    diff,
  };
  return NextResponse.json(body);
}
