import { NextRequest, NextResponse } from "next/server";
import dns from "node:dns/promises";
import net from "node:net";
import { applyRowCap } from "@/lib/sparql";

export const runtime = "nodejs";
// Vercel kapper til planens maks (Hobby 60 s, Pro 300 s). Endepunktet har selv 2 min grense.
export const maxDuration = 300;

const ROW_CAP = Number(process.env.SPARQL_ROW_CAP ?? 50000);
// Klientens fetch-timeout bør ligge litt over dette.
const UPSTREAM_TIMEOUT_MS = Number(process.env.SPARQL_TIMEOUT_MS ?? 125000);

/** Blokkerer åpenbart interne adresser (SSRF-vern for egendefinerte endepunkter). */
function isBlockedAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number);
    if (a === 0 || a === 127 || a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local + sky-metadata
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  const v = ip.toLowerCase();
  if (v === "::1" || v === "::" ) return true;
  if (v.startsWith("fe80") || v.startsWith("fc") || v.startsWith("fd")) return true;
  if (v.startsWith("::ffff:")) return isBlockedAddress(v.slice(7));
  return false;
}

async function assertSafeUrl(raw: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Response("Ugyldig endepunkt-URL.", { status: 400 });
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Response("Endepunktet må bruke http eller https.", { status: 400 });
  }
  const host = url.hostname;
  const addrs = net.isIP(host)
    ? [host]
    : (await dns.lookup(host, { all: true })).map((a) => a.address);
  if (addrs.length === 0 || addrs.some(isBlockedAddress)) {
    throw new Response("Endepunktet peker mot en intern adresse og er blokkert.", {
      status: 400,
    });
  }
  return url;
}

export async function POST(req: NextRequest) {
  let body: { url?: string; query?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Forventet JSON-body." }, { status: 400 });
  }

  const rawUrl = (body.url ?? "").trim();
  const rawQuery = (body.query ?? "").trim();
  if (!rawUrl) return NextResponse.json({ error: "Mangler endepunkt." }, { status: 400 });
  if (!rawQuery) return NextResponse.json({ error: "Mangler spørring." }, { status: 400 });

  let endpoint: URL;
  try {
    endpoint = await assertSafeUrl(rawUrl);
  } catch (e) {
    if (e instanceof Response) {
      return NextResponse.json({ error: await e.text() }, { status: e.status });
    }
    return NextResponse.json({ error: "Kunne ikke slå opp endepunktet." }, { status: 400 });
  }

  const { query: effectiveQuery, capApplied } = applyRowCap(rawQuery, ROW_CAP);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const started = Date.now();

  let upstream: Response;
  try {
    upstream = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/sparql-results+json",
      },
      body: new URLSearchParams({ query: effectiveQuery }).toString(),
      signal: controller.signal,
      cache: "no-store",
    });
  } catch (e) {
    clearTimeout(timer);
    const aborted = e instanceof Error && e.name === "AbortError";
    return NextResponse.json(
      {
        error: aborted
          ? `Spørringen brukte for lang tid (over ${Math.round(UPSTREAM_TIMEOUT_MS / 1000)} sek) og ble avbrutt.`
          : `Fikk ikke kontakt med endepunktet: ${(e as Error).message}`,
      },
      { status: aborted ? 504 : 502 },
    );
  }
  clearTimeout(timer);
  const ms = Date.now() - started;

  const text = await upstream.text();

  if (!upstream.ok) {
    return NextResponse.json(
      {
        error: text.slice(0, 4000) || `Endepunktet svarte med HTTP ${upstream.status}.`,
        status: upstream.status,
        ms,
      },
      { status: 502 },
    );
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return NextResponse.json(
      { error: "Endepunktet svarte med noe annet enn JSON.", raw: text.slice(0, 4000), ms },
      { status: 502 },
    );
  }

  return NextResponse.json({
    data,
    ms,
    capApplied,
    rowCap: ROW_CAP,
    effectiveQuery,
  });
}
