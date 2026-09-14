import type {
  EndpointResult,
  NumStats,
  RunParams,
  SingleCall,
} from "./types";
import { rowCount, tryParse } from "./sparql";

interface RawCall {
  call: SingleCall;
  body: string;
  contentType: string;
}

/**
 * One POST to a SPARQL endpoint, measured server-side.
 * Streams the body so we can record time-to-first-byte separately from
 * the full download time.
 */
async function timedCall(
  url: string,
  query: string,
  timeoutMs: number,
): Promise<RawCall> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  const t0 = performance.now();
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        accept: "application/sparql-results+json",
      },
      body: "query=" + encodeURIComponent(query),
      signal: ac.signal,
    });

    let ttfbMs: number | null = null;
    let bytes = 0;
    const chunks: Uint8Array[] = [];
    if (res.body) {
      const reader = res.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (ttfbMs === null) ttfbMs = performance.now() - t0;
        bytes += value.byteLength;
        chunks.push(value);
      }
    }
    const totalMs = performance.now() - t0;
    const body = Buffer.concat(chunks).toString("utf8");
    return {
      call: { ok: res.ok, httpStatus: res.status, totalMs, ttfbMs, bytes },
      body,
      contentType: res.headers.get("content-type") ?? "",
    };
  } catch (e) {
    const totalMs = performance.now() - t0;
    const err = e as { name?: string; message?: string };
    const aborted = err?.name === "AbortError";
    return {
      call: {
        ok: false,
        httpStatus: 0,
        totalMs,
        ttfbMs: null,
        bytes: 0,
        error: aborted
          ? `Timeout etter ${timeoutMs} ms`
          : String(err?.message ?? e),
      },
      body: "",
      contentType: "",
    };
  } finally {
    clearTimeout(timer);
  }
}

function stats(xs: number[]): NumStats | null {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const pct = (p: number) => {
    const idx = Math.min(
      v.length - 1,
      Math.max(0, Math.ceil(p * v.length) - 1),
    );
    return v[idx];
  };
  const median =
    v.length % 2
      ? v[(v.length - 1) / 2]
      : (v[v.length / 2 - 1] + v[v.length / 2]) / 2;
  return {
    min: v[0],
    max: v[v.length - 1],
    median,
    mean: v.reduce((a, b) => a + b, 0) / v.length,
    p95: pct(0.95),
  };
}

/** Run `tasks` with at most `concurrency` in flight, preserving order. */
async function pool<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;
  async function worker() {
    while (next < tasks.length) {
      const idx = next++;
      results[idx] = await tasks[idx]();
    }
  }
  const n = Math.max(1, Math.min(concurrency, tasks.length));
  await Promise.all(Array.from({ length: n }, worker));
  return results;
}

/** First (cold) call, then `warmup` discarded calls. */
async function prime(
  url: string,
  query: string,
  warmup: number,
  timeoutMs: number,
): Promise<SingleCall> {
  const first = await timedCall(url, query, timeoutMs);
  for (let i = 0; i < warmup; i++) {
    await timedCall(url, query, timeoutMs);
  }
  return first.call;
}

function summarize(
  url: string,
  cold: SingleCall,
  samples: SingleCall[],
  okBody: string,
  lastBody: string,
  contentType: string,
  wallMs: number | null,
): EndpointResult {
  const ok = samples.filter((s) => s.ok);
  const parsed = okBody ? tryParse(okBody) : null;
  const errors = Array.from(
    new Set(samples.filter((s) => s.error).map((s) => s.error as string)),
  );
  const preview = okBody || lastBody;
  return {
    url,
    cold,
    samples,
    stats: {
      count: samples.length,
      totalMs: stats(ok.map((s) => s.totalMs)),
      ttfbMs: stats(ok.map((s) => s.ttfbMs ?? NaN)),
      bytes: ok.length ? ok[ok.length - 1].bytes : null,
      rowCount: rowCount(parsed),
      httpStatus: samples.length
        ? samples[samples.length - 1].httpStatus
        : null,
      contentType: contentType || null,
      ok: samples.length > 0 && ok.length === samples.length,
      wallMs,
      throughputPerSec:
        wallMs && wallMs > 0 ? (samples.length / wallMs) * 1000 : null,
      errorRate: samples.length
        ? (samples.length - ok.length) / samples.length
        : 0,
    },
    errors,
    bodyPreview: preview ? preview.slice(0, 20000) : null,
    parsed,
  };
}

function bodyPicker() {
  let okBody = "";
  let lastBody = "";
  let contentType = "";
  return {
    feed(r: RawCall) {
      lastBody = r.body || lastBody;
      if (r.call.ok) {
        okBody = r.body;
        contentType = r.contentType;
      }
    },
    get: () => ({ okBody, lastBody, contentType }),
  };
}

/**
 * Cold + warmup both endpoints, then run `iterations` measured calls.
 * - concurrency 1: interleaved (prod, test, prod, test, …) so slow drift
 *   in network conditions hits both sides evenly.
 * - concurrency > 1: load mode — prod batch (pooled), then test batch
 *   (pooled); wall time and throughput are recorded.
 */
export async function runComparison(
  endpoints: { prod: string; test: string },
  p: RunParams,
): Promise<{ prod: EndpointResult; test: EndpointResult }> {
  const concurrency = Math.max(1, Math.floor(p.concurrency ?? 1));

  const prodCold = await prime(
    endpoints.prod,
    p.query,
    p.warmup,
    p.timeoutMs,
  );
  const testCold = await prime(
    endpoints.test,
    p.query,
    p.warmup,
    p.timeoutMs,
  );

  const prodSamples: SingleCall[] = [];
  const testSamples: SingleCall[] = [];
  const prodBody = bodyPicker();
  const testBody = bodyPicker();
  let prodWall: number | null = null;
  let testWall: number | null = null;

  if (concurrency === 1) {
    for (let i = 0; i < p.iterations; i++) {
      const a = await timedCall(endpoints.prod, p.query, p.timeoutMs);
      prodSamples.push(a.call);
      prodBody.feed(a);
      const b = await timedCall(endpoints.test, p.query, p.timeoutMs);
      testSamples.push(b.call);
      testBody.feed(b);
    }
  } else {
    const mkTasks = (url: string) =>
      Array.from(
        { length: p.iterations },
        () => () => timedCall(url, p.query, p.timeoutMs),
      );

    const p0 = performance.now();
    const pr = await pool(mkTasks(endpoints.prod), concurrency);
    prodWall = performance.now() - p0;
    for (const r of pr) {
      prodSamples.push(r.call);
      prodBody.feed(r);
    }

    const t0 = performance.now();
    const te = await pool(mkTasks(endpoints.test), concurrency);
    testWall = performance.now() - t0;
    for (const r of te) {
      testSamples.push(r.call);
      testBody.feed(r);
    }
  }

  const pb = prodBody.get();
  const tb = testBody.get();
  return {
    prod: summarize(
      endpoints.prod,
      prodCold,
      prodSamples,
      pb.okBody,
      pb.lastBody,
      pb.contentType,
      prodWall,
    ),
    test: summarize(
      endpoints.test,
      testCold,
      testSamples,
      tb.okBody,
      tb.lastBody,
      tb.contentType,
      testWall,
    ),
  };
}
