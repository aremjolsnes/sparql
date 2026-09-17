import { promises as fs } from "fs";
import path from "path";
import { adminConfigured, secretClient } from "@/lib/supabase/admin";
import type { BatchReport, BatchReportSummary, SavedQuery } from "./types";

const QUERIES_DIR = path.join(process.cwd(), "queries");
const REPORTS_DIR = path.join(process.cwd(), "data", "reports");

/** With Supabase configured we persist there; without it we use the local filesystem. */
const useSupabase = adminConfigured();

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

async function listSupabaseQueries(): Promise<SavedQuery[]> {
  const { data, error } = await secretClient()
    .from("fuseki_test_queries")
    .select("name, query");
  if (error) throw error;
  return (data ?? []) as SavedQuery[];
}

export async function listQueries(): Promise<SavedQuery[]> {
  const files = await listQueryFiles();
  if (!useSupabase) return files;
  const map = new Map<string, SavedQuery>();
  for (const q of files) map.set(q.name, q); // committed baseline
  for (const q of await listSupabaseQueries()) map.set(q.name, q); // Supabase overrides
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name, "no"));
}

export async function saveQuery(
  name: string,
  query: string,
): Promise<SavedQuery> {
  const n = safeName(name);
  if (useSupabase) {
    const { error } = await secretClient()
      .from("fuseki_test_queries")
      .upsert(
        { name: n, query, updated_at: new Date().toISOString() },
        { onConflict: "name" },
      );
    if (error) throw error;
  } else {
    await fs.mkdir(QUERIES_DIR, { recursive: true });
    await fs.writeFile(path.join(QUERIES_DIR, `${n}.rq`), query, "utf8");
  }
  return { name: n, query };
}

export async function deleteQuery(name: string): Promise<void> {
  const n = safeName(name);
  if (useSupabase) {
    const client = secretClient();
    const { data, error: selErr } = await client
      .from("fuseki_test_queries")
      .select("name")
      .eq("name", n)
      .maybeSingle();
    if (selErr) throw selErr;
    if (!data) {
      throw Object.assign(
        new Error(
          "Innebygde spørringer kan ikke slettes – bare de du selv har lagret.",
        ),
        { code: "EBUILTIN" },
      );
    }
    const { error } = await client
      .from("fuseki_test_queries")
      .delete()
      .eq("name", n);
    if (error) throw error;
  } else {
    await fs.rm(path.join(QUERIES_DIR, `${n}.rq`), { force: true });
  }
}

// ---------------------------------------------------------------------------
// Batch reports
// ---------------------------------------------------------------------------

export async function saveReport(report: BatchReport): Promise<void> {
  const id = safeId(report.id);
  if (useSupabase) {
    const { error } = await secretClient()
      .from("fuseki_test_reports")
      .insert({ id, created_at: report.createdAt, data: report });
    if (error) throw error;
  } else {
    await fs.mkdir(REPORTS_DIR, { recursive: true });
    await fs.writeFile(
      path.join(REPORTS_DIR, `${id}.json`),
      JSON.stringify(report, null, 2),
      "utf8",
    );
  }
}

export async function getReport(id: string): Promise<BatchReport | null> {
  const sid = safeId(id);
  if (useSupabase) {
    const { data, error } = await secretClient()
      .from("fuseki_test_reports")
      .select("data")
      .eq("id", sid)
      .maybeSingle();
    if (error) throw error;
    return (data?.data as BatchReport) ?? null;
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
  if (useSupabase) {
    const { data, error } = await secretClient()
      .from("fuseki_test_reports")
      .select("data")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []).map((row) => summarize(row.data as BatchReport));
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
