import { promises as fs } from "fs";
import path from "path";
import { del, list, put } from "@vercel/blob";
import type { BatchReport, BatchReportSummary, SavedQuery } from "./types";

const QUERIES_DIR = path.join(process.cwd(), "queries");
const REPORTS_DIR = path.join(process.cwd(), "data", "reports");

const BLOB_TOKEN = process.env.BLOB_READ_WRITE_TOKEN;
/** With a Blob token we persist to Vercel Blob; without it we use the local filesystem. */
const useBlob = Boolean(BLOB_TOKEN);

const Q_PREFIX = "queries/";
const R_PREFIX = "reports/";

/** Filename-safe query name: letters, numbers, space, _ and - only. */
export function safeName(name: string): string {
  const base = name
    .trim()
    .replace(/[^\p{L}\p{N} _-]/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 80);
  if (!base) throw new Error("Ugyldig navn.");
  return base;
}

function safeId(id: string): string {
  const s = id.replace(/[^0-9A-Za-z_-]/g, "");
  if (!s) throw new Error("Ugyldig id.");
  return s;
}

// ---------------------------------------------------------------------------
// Blob helpers
// ---------------------------------------------------------------------------

async function blobList(prefix: string) {
  const out: { pathname: string; url: string; uploadedAt: Date }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix, cursor, token: BLOB_TOKEN });
    out.push(...page.blobs);
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return out;
}

async function blobText(url: string): Promise<string | null> {
  const res = await fetch(url, { cache: "no-store" });
  return res.ok ? res.text() : null;
}

async function blobPut(pathname: string, body: string, contentType: string) {
  await put(pathname, body, {
    access: "public",
    token: BLOB_TOKEN,
    contentType,
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

// ---------------------------------------------------------------------------
// Saved queries
// ---------------------------------------------------------------------------

/** Queries committed to the repo under queries/. Always available (read-only on Vercel). */
async function listQueryFiles(): Promise<SavedQuery[]> {
  try {
    const files = (await fs.readdir(QUERIES_DIR)).filter((f) =>
      f.endsWith(".rq"),
    );
    const out: SavedQuery[] = [];
    for (const f of files.sort()) {
      out.push({
        name: f.replace(/\.rq$/, ""),
        query: await fs.readFile(path.join(QUERIES_DIR, f), "utf8"),
      });
    }
    return out;
  } catch {
    return [];
  }
}

async function listQueryBlobs(): Promise<SavedQuery[]> {
  const blobs = await blobList(Q_PREFIX);
  const out: SavedQuery[] = [];
  for (const b of blobs) {
    if (!b.pathname.endsWith(".rq")) continue;
    const query = await blobText(b.url);
    if (query != null) {
      out.push({ name: b.pathname.slice(Q_PREFIX.length, -3), query });
    }
  }
  return out;
}

export async function listQueries(): Promise<SavedQuery[]> {
  const files = await listQueryFiles();
  if (!useBlob) return files;
  const map = new Map<string, SavedQuery>();
  for (const q of files) map.set(q.name, q); // committed baseline
  for (const q of await listQueryBlobs()) map.set(q.name, q); // Blob overrides
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "no"));
}

export async function saveQuery(
  name: string,
  query: string,
): Promise<SavedQuery> {
  const n = safeName(name);
  if (useBlob) {
    await blobPut(`${Q_PREFIX}${n}.rq`, query, "text/plain; charset=utf-8");
  } else {
    await fs.mkdir(QUERIES_DIR, { recursive: true });
    await fs.writeFile(path.join(QUERIES_DIR, `${n}.rq`), query, "utf8");
  }
  return { name: n, query };
}

export async function deleteQuery(name: string): Promise<void> {
  const n = safeName(name);
  if (useBlob) {
    const pathname = `${Q_PREFIX}${n}.rq`;
    const hit = (await blobList(pathname)).find((b) => b.pathname === pathname);
    if (!hit) {
      throw Object.assign(
        new Error(
          "Innebygde spørringer kan ikke slettes – bare de du selv har lagret.",
        ),
        { code: "EBUILTIN" },
      );
    }
    await del(hit.url, { token: BLOB_TOKEN });
  } else {
    await fs.rm(path.join(QUERIES_DIR, `${n}.rq`), { force: true });
  }
}

// ---------------------------------------------------------------------------
// Batch reports
// ---------------------------------------------------------------------------

export async function saveReport(report: BatchReport): Promise<void> {
  const body = JSON.stringify(report, null, 2);
  if (useBlob) {
    await blobPut(
      `${R_PREFIX}${safeId(report.id)}.json`,
      body,
      "application/json",
    );
  } else {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
    await fs.writeFile(
      path.join(REPORTS_DIR, `${safeId(report.id)}.json`),
      body,
      "utf8",
    );
  }
}

export async function getReport(id: string): Promise<BatchReport | null> {
  const sid = safeId(id);
  if (useBlob) {
    const pathname = `${R_PREFIX}${sid}.json`;
    const hit = (await blobList(pathname)).find((b) => b.pathname === pathname);
    if (!hit) return null;
    const raw = await blobText(hit.url);
    return raw ? (JSON.parse(raw) as BatchReport) : null;
  }
  try {
    const raw = await fs.readFile(
      path.join(REPORTS_DIR, `${sid}.json`),
      "utf8",
    );
    return JSON.parse(raw) as BatchReport;
  } catch {
    return null;
  }
}

function summarize(r: BatchReport): BatchReportSummary {
  let equal = 0;
  let differing = 0;
  let incomparable = 0;
  for (const it of r.items) {
    if (!it.diffComparable) incomparable++;
    else if (it.diffEqual) equal++;
    else differing++;
  }
  return {
    id: r.id,
    createdAt: r.createdAt,
    count: r.items.length,
    equal,
    differing,
    incomparable,
  };
}

export async function listReportSummaries(): Promise<BatchReportSummary[]> {
  if (useBlob) {
    const blobs = await blobList(R_PREFIX);
    const out: BatchReportSummary[] = [];
    for (const b of blobs) {
      if (!b.pathname.endsWith(".json")) continue;
      const raw = await blobText(b.url);
      if (!raw) continue;
      try {
        out.push(summarize(JSON.parse(raw) as BatchReport));
      } catch {
        /* skip */
      }
    }
    return out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  try {
    const files = (await fs.readdir(REPORTS_DIR)).filter((f) =>
      f.endsWith(".json"),
    );
    const out: BatchReportSummary[] = [];
    for (const f of files.sort().reverse()) {
      try {
        out.push(
          summarize(
            JSON.parse(
              await fs.readFile(path.join(REPORTS_DIR, f), "utf8"),
            ) as BatchReport,
          ),
        );
      } catch {
        /* skip */
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function newReportId(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}
