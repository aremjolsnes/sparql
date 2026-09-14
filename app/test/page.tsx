"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  ComparisonResponse,
  DiffRow,
  EndpointResult,
  NumStats,
  SavedQuery,
  Term,
} from "@/lib/fuseki-test/types";

const SAMPLE_QUERY = `PREFIX u: <http://psi.udir.no/ontologi/kl06/>
select * where {
  ?s a u:aarstrinn .
}`;

function ms(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${n.toFixed(0)} ms`;
}

function kb(n: number | null | undefined): string {
  if (n == null) return "–";
  return n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`;
}

function span(s: NumStats | null): string {
  if (!s) return "–";
  return `${ms(s.min)} – ${ms(s.p95)}`;
}

function bindingText(row: DiffRow): string {
  const parts = Object.entries(row.binding).map(([k, t]) => `${k}=${t.value}`);
  const suffix = row.count > 1 ? ` ×${row.count}` : "";
  return `{ ${parts.join(", ")} }${suffix}`;
}

function fmtTerm(t: Term | null): string {
  if (!t) return "(mangler)";
  let s = JSON.stringify(t.value ?? "");
  if (t["xml:lang"]) s += `@${t["xml:lang"]}`;
  if (t.datatype)
    s += ` ^^${t.datatype.replace("http://www.w3.org/2001/XMLSchema#", "xsd:")}`;
  if (t.type && t.type !== "literal" && t.type !== "uri") s += ` [${t.type}]`;
  else if (t.type === "uri") s += " [uri]";
  return s;
}

export default function Page() {
  const router = useRouter();
  const [query, setQuery] = useState(SAMPLE_QUERY);
  const [iterations, setIterations] = useState(5);
  const [warmup, setWarmup] = useState(1);
  const [timeoutSec, setTimeoutSec] = useState(60);
  const [loadMode, setLoadMode] = useState(false);
  const [concurrency, setConcurrency] = useState(5);
  const [prodUrl, setProdUrl] = useState("");
  const [testUrl, setTestUrl] = useState("");

  const [saved, setSaved] = useState<SavedQuery[]>([]);
  const [selected, setSelected] = useState("");
  const [saveName, setSaveName] = useState("");

  const [loading, setLoading] = useState(false);
  const [batching, setBatching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [result, setResult] = useState<ComparisonResponse | null>(null);

  useEffect(() => {
    fetch("/api/test/config")
      .then((r) => r.json())
      .then((c: { prod: string; test: string }) => {
        setProdUrl(c.prod);
        setTestUrl(c.test);
      })
      .catch(() => {});
    refreshSaved();
  }, []);

  async function refreshSaved() {
    try {
      const r = await fetch("/api/test/queries");
      setSaved(await r.json());
    } catch {
      /* ignore */
    }
  }

  function loadSaved(name: string) {
    setSelected(name);
    const q = saved.find((s) => s.name === name);
    if (q) {
      setQuery(q.query);
      setSaveName(q.name);
    }
  }

  async function saveCurrent() {
    const name = saveName.trim();
    if (!name) {
      setError("Gi spørringen et navn før du lagrer.");
      return;
    }
    setError(null);
    try {
      const r = await fetch("/api/test/queries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, query }),
      });
      const data = await r.json();
      if (!r.ok) {
        setError(data?.error ?? `HTTP ${r.status}`);
        return;
      }
      setNotice(`Lagret som «${data.name}».`);
      await refreshSaved();
      setSelected(data.name);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    if (!confirm(`Slette lagret spørring «${selected}»?`)) return;
    await fetch(`/api/test/queries?name=${encodeURIComponent(selected)}`, {
      method: "DELETE",
    });
    setSelected("");
    await refreshSaved();
  }

  function commonParams() {
    return {
      iterations,
      warmup,
      timeoutMs: timeoutSec * 1000,
      concurrency: loadMode ? concurrency : 1,
      endpoints: { prod: prodUrl, test: testUrl },
    };
  }

  async function run() {
    setLoading(true);
    setError(null);
    setNotice(null);
    setResult(null);
    try {
      const res = await fetch("/api/test/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ query, ...commonParams() }),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.error ?? `HTTP ${res.status}`);
      else setResult(data as ComparisonResponse);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setLoading(false);
    }
  }

  async function runBatch() {
    if (saved.length === 0) {
      setError("Ingen lagrede spørringer å kjøre.");
      return;
    }
    setBatching(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/test/batch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(commonParams()),
      });
      const data = await res.json();
      if (!res.ok) setError(data?.error ?? `HTTP ${res.status}`);
      else if (data.saved === false)
        setNotice(
          `Batch kjørt (${data.items.length} spørringer), men rapporten kunne ikke lagres her (skrivebeskyttet filsystem på Vercel). Kjør lokalt for å se den under /test/report.`,
        );
      else router.push(`/test/report/${data.id}`);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBatching(false);
    }
  }

  const busy = loading || batching;

  return (
    <main>
      <p className="sub">
        Kjør SPARQL mot dagens GraphDB og test-Fuseki, og sammenlign
        responstid, ytelse og responsinnhold. <Link href="/test/report">Rapporter →</Link>
      </p>

      <div className="row" style={{ marginTop: 0 }}>
        <div className="field" style={{ flex: "2 1 240px" }}>
          <label htmlFor="saved">Lagret spørring</label>
          <select
            id="saved"
            value={selected}
            onChange={(e) => loadSaved(e.target.value)}
            style={selectStyle}
          >
            <option value="">— velg —</option>
            {saved.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: "2 1 240px" }}>
          <label htmlFor="sn">Lagre som</label>
          <input
            id="sn"
            type="text"
            value={saveName}
            placeholder="navn"
            onChange={(e) => setSaveName(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: "0 0 auto", alignSelf: "end" }}>
          <button type="button" onClick={saveCurrent} style={smallBtn}>
            Lagre
          </button>
          {selected && (
            <button
              type="button"
              onClick={deleteSelected}
              style={{ ...smallBtn, background: "transparent", color: "var(--bad-fg)" }}
            >
              Slett
            </button>
          )}
        </div>
      </div>

      <label htmlFor="q" style={{ marginTop: "1rem" }}>
        SPARQL-spørring (ikke URL-enkodet)
      </label>
      <textarea
        id="q"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        spellCheck={false}
      />

      <div className="row">
        <div className="field">
          <label htmlFor="it">Iterasjoner</label>
          <input
            id="it"
            type="number"
            min={1}
            max={200}
            value={iterations}
            onChange={(e) => setIterations(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="wu">Warmup (forkastes)</label>
          <input
            id="wu"
            type="number"
            min={0}
            max={10}
            value={warmup}
            onChange={(e) => setWarmup(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="to">Timeout (sek)</label>
          <input
            id="to"
            type="number"
            min={1}
            max={120}
            value={timeoutSec}
            onChange={(e) => setTimeoutSec(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label htmlFor="cc">Samtidige kall</label>
          <input
            id="cc"
            type="number"
            min={2}
            max={50}
            value={concurrency}
            disabled={!loadMode}
            onChange={(e) => setConcurrency(Number(e.target.value))}
          />
        </div>
      </div>

      <label
        style={{ fontWeight: 400, marginTop: "0.75rem", display: "flex", gap: "0.5rem" }}
      >
        <input
          type="checkbox"
          checked={loadMode}
          onChange={(e) => setLoadMode(e.target.checked)}
          style={{ width: "auto" }}
        />
        Last-modus: kjør iterasjonene parallelt (måler også gjennomstrømning)
      </label>

      <details>
        <summary>Endepunkter</summary>
        <div style={{ marginTop: "0.75rem" }}>
          <label htmlFor="pu">Dagens (GraphDB)</label>
          <input
            id="pu"
            type="text"
            value={prodUrl}
            onChange={(e) => setProdUrl(e.target.value)}
          />
          <label htmlFor="tu" style={{ marginTop: "0.75rem" }}>
            Test (Fuseki)
          </label>
          <input
            id="tu"
            type="text"
            value={testUrl}
            onChange={(e) => setTestUrl(e.target.value)}
          />
        </div>
      </details>

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
        <button onClick={run} disabled={busy}>
          {loading ? "Kjører…" : "Run"}
        </button>
        <button
          onClick={runBatch}
          disabled={busy || saved.length === 0}
          style={{ background: "transparent", color: "var(--accent)", border: "1px solid var(--accent)" }}
        >
          {batching ? "Kjører alle…" : `Kjør alle lagrede (${saved.length})`}
        </button>
      </div>

      {notice && <div className="banner ok">{notice}</div>}
      {error && <div className="error">{error}</div>}

      {result && <Results data={result} />}
    </main>
  );
}

function Results({ data }: { data: ComparisonResponse }) {
  const { diff, prod, test, params } = data;
  const load = params.concurrency > 1;

  let banner: { cls: string; text: string };
  if (!diff.comparable) {
    banner = { cls: "warn", text: `Kan ikke sammenlignes: ${diff.reason}` };
  } else if (diff.equal) {
    banner = { cls: "ok", text: "Responsene er like (semantisk)." };
  } else {
    banner = { cls: "bad", text: "Forskjeller funnet i responsene." };
  }

  return (
    <>
      <div className={`banner ${banner.cls}`}>{banner.text}</div>

      <h2>Måling</h2>
      <p className="sub" style={{ margin: "0 0 0.5rem" }}>
        {params.iterations} iterasjoner, {params.warmup} warmup,{" "}
        {load ? `samtidighet ${params.concurrency}` : "sekvensielt interleaved"}.
        Total kjøretid {ms(data.elapsedMs)}.
      </p>
      <table>
        <thead>
          <tr>
            <th>Metrikk</th>
            <th>Dagens (GraphDB)</th>
            <th>Test (Fuseki)</th>
          </tr>
        </thead>
        <tbody>
          <MetricRow
            label="Total tid, median"
            p={ms(prod.stats.totalMs?.median)}
            t={ms(test.stats.totalMs?.median)}
          />
          <MetricRow
            label="Total tid, min–p95"
            p={span(prod.stats.totalMs)}
            t={span(test.stats.totalMs)}
          />
          <MetricRow
            label="TTFB, median"
            p={ms(prod.stats.ttfbMs?.median)}
            t={ms(test.stats.ttfbMs?.median)}
          />
          <MetricRow
            label="Kaldstart (1. kall)"
            p={coldText(prod)}
            t={coldText(test)}
          />
          {load && (
            <MetricRow
              label="Gjennomstrømning"
              p={tput(prod)}
              t={tput(test)}
            />
          )}
          {load && (
            <MetricRow
              label="Feilrate"
              p={`${(prod.stats.errorRate * 100).toFixed(0)} %`}
              t={`${(test.stats.errorRate * 100).toFixed(0)} %`}
            />
          )}
          <MetricRow
            label="Responsstørrelse"
            p={kb(prod.stats.bytes)}
            t={kb(test.stats.bytes)}
          />
          <MetricRow
            label="Antall rader"
            p={prod.stats.rowCount ?? "–"}
            t={test.stats.rowCount ?? "–"}
          />
          <MetricRow
            label="HTTP-status"
            p={prod.stats.httpStatus ?? "–"}
            t={test.stats.httpStatus ?? "–"}
          />
        </tbody>
      </table>

      {(prod.errors.length > 0 || test.errors.length > 0) && (
        <>
          <h2>Feil</h2>
          <table>
            <tbody>
              <tr>
                <th>Dagens</th>
                <td>{prod.errors.join("; ") || "–"}</td>
              </tr>
              <tr>
                <th>Test</th>
                <td>{test.errors.join("; ") || "–"}</td>
              </tr>
            </tbody>
          </table>
        </>
      )}

      {diff.comparable && diff.kind === "select" && diff.rows && (
        <>
          <h2>Respons-diff</h2>
          <table>
            <tbody>
              <tr>
                <th>Rader dagens / test</th>
                <td>
                  {diff.rows.prodCount} / {diff.rows.testCount} (
                  {diff.rows.identical} like)
                </td>
              </tr>
              {diff.vars && !diff.vars.equal && (
                <tr>
                  <th>Variabler avviker</th>
                  <td>
                    kun dagens: {diff.vars.onlyInProd.join(", ") || "–"}; kun
                    test: {diff.vars.onlyInTest.join(", ") || "–"}
                  </td>
                </tr>
              )}
              {diff.rows.onlyInProd.length > 0 && (
                <tr>
                  <th>Kun i dagens</th>
                  <td>
                    <ul className="tight">
                      {diff.rows.onlyInProd.map((r, i) => (
                        <li key={i}>
                          <code>{bindingText(r)}</code>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              )}
              {diff.rows.onlyInTest.length > 0 && (
                <tr>
                  <th>Kun i test</th>
                  <td>
                    <ul className="tight">
                      {diff.rows.onlyInTest.map((r, i) => (
                        <li key={i}>
                          <code>{bindingText(r)}</code>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              )}
              {diff.rows.truncated && (
                <tr>
                  <th />
                  <td>… flere forskjeller ikke vist (avkortet).</td>
                </tr>
              )}
            </tbody>
          </table>

          {diff.rows.mismatchSamples.length > 0 && (
            <>
              <h2>Feltavvik</h2>
              <p className="sub" style={{ margin: "0 0 0.5rem" }}>
                Avvikende rader paret på tvers av endepunktene; bare feltene som
                faktisk er ulike vises.
              </p>
              <table>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Felt</th>
                    <th>Dagens (GraphDB)</th>
                    <th>Test (Fuseki)</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.rows.mismatchSamples.flatMap((s, si) =>
                    s.fields.map((f, fi) => (
                      <tr key={`${si}-${fi}`}>
                        <td className="num">{fi === 0 ? si + 1 : ""}</td>
                        <td>
                          <code>{f.key}</code>
                        </td>
                        <td>
                          <code>{fmtTerm(f.prod)}</code>
                        </td>
                        <td>
                          <code>{fmtTerm(f.test)}</code>
                        </td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </>
          )}
        </>
      )}

      {diff.comparable && diff.kind === "ask" && diff.ask && (
        <>
          <h2>Respons-diff (ASK)</h2>
          <p>
            dagens: <code>{String(diff.ask.prod)}</code> · test:{" "}
            <code>{String(diff.ask.test)}</code>
          </p>
        </>
      )}

      <h2>Rå respons</h2>
      <details>
        <summary>Dagens (GraphDB)</summary>
        <pre>{prod.bodyPreview ?? "(tom)"}</pre>
      </details>
      <details>
        <summary>Test (Fuseki)</summary>
        <pre>{test.bodyPreview ?? "(tom)"}</pre>
      </details>
    </>
  );
}

function coldText(r: Pick<EndpointResult, "cold">): string {
  if (!r.cold) return "–";
  if (r.cold.error) return r.cold.error;
  if (!r.cold.ok) return `HTTP ${r.cold.httpStatus} (${ms(r.cold.totalMs)})`;
  return ms(r.cold.totalMs);
}

function tput(r: Pick<EndpointResult, "stats">): string {
  const v = r.stats.throughputPerSec;
  return v == null ? "–" : `${v.toFixed(1)} req/s`;
}

function MetricRow({
  label,
  p,
  t,
}: {
  label: string;
  p: React.ReactNode;
  t: React.ReactNode;
}) {
  return (
    <tr>
      <th>{label}</th>
      <td className="num">{p}</td>
      <td className="num">{t}</td>
    </tr>
  );
}

const selectStyle: React.CSSProperties = {
  width: "100%",
  fontFamily: "var(--mono)",
  fontSize: "0.9rem",
  color: "var(--fg)",
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  padding: "0.6rem 0.7rem",
};

const smallBtn: React.CSSProperties = {
  marginTop: 0,
  marginRight: "0.5rem",
  padding: "0.55rem 1rem",
  fontSize: "0.9rem",
};
