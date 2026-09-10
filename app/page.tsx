"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SparqlEditor from "@/components/SparqlEditor";
import ResultsTable from "@/components/ResultsTable";
import Pagination from "@/components/Pagination";
import Tabs from "@/components/Tabs";
import EndpointBar from "@/components/EndpointBar";
import { BUILTIN_ENDPOINTS, DEFAULT_ENDPOINT_NAME, PAGE_SIZE, Endpoint } from "@/lib/endpoints";
import { ensurePrefixes } from "@/lib/prefixes";
import { SparqlResults, SparqlTerm, resultVars, toCsv } from "@/lib/sparql";
import { useAuth } from "@/components/AuthProvider";
import AuthBar from "@/components/AuthBar";
import SavedQueriesMenu from "@/components/SavedQueriesMenu";
import { SavedQuery } from "@/lib/savedQueries";
import { loadRemoteTabs, saveRemoteTabs } from "@/lib/tabsSync";
import {
  DEFAULT_QUERY,
  Tab,
  ViewMode,
  loadTabs,
  loadViewMode,
  loadCustomEndpoints,
  loadEndpointName,
  saveTabs,
  saveActiveId,
  saveViewMode,
  saveCustomEndpoints,
  saveEndpointName,
  newId,
} from "@/lib/storage";

type Run = {
  status: "running" | "done" | "error";
  error?: string;
  kind: "table" | "boolean" | "graph";
  vars: string[];
  bindings: Record<string, SparqlTerm>[];
  boolean?: boolean;
  rawText?: string;
  ms: number;
  ranAt: number;
  capApplied: boolean;
  rowCap: number;
  page: number;
};

const nf = new Intl.NumberFormat("nb-NO");
const sf = new Intl.NumberFormat("nb-NO", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function fmtDateTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(
    d.getMinutes(),
  )}`;
}

const VIEW_LABELS: Record<ViewMode, string> = {
  editor: "Kun editor",
  both: "Editor og resultater",
  results: "Kun resultater",
};

export default function Page() {
  const [hydrated, setHydrated] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([{ id: "seed", name: null, query: DEFAULT_QUERY }]);
  const [activeId, setActiveId] = useState("seed");
  const [viewMode, setViewMode] = useState<ViewMode>("both");
  const [custom, setCustom] = useState<Endpoint[]>([]);
  const [endpointName, setEndpointName] = useState(DEFAULT_ENDPOINT_NAME);
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorBoxRef = useRef<HTMLDivElement | null>(null);

  const { enabled: authEnabled, user } = useAuth();
  const [remoteReady, setRemoteReady] = useState(false);
  const remoteSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const t = loadTabs();
    setTabs(t.tabs);
    setActiveId(t.activeId);
    setViewMode(loadViewMode());
    setCustom(loadCustomEndpoints());
    const en = loadEndpointName();
    if (en) setEndpointName(en);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) saveTabs(tabs);
  }, [tabs, hydrated]);
  useEffect(() => {
    if (hydrated) saveActiveId(activeId);
  }, [activeId, hydrated]);
  useEffect(() => {
    if (hydrated) saveViewMode(viewMode);
  }, [viewMode, hydrated]);
  useEffect(() => {
    if (hydrated) saveCustomEndpoints(custom);
  }, [custom, hydrated]);
  useEffect(() => {
    if (hydrated) saveEndpointName(endpointName);
  }, [endpointName, hydrated]);

  // Editorhøyde: bruk lagret verdi, og lagre når brukeren drar i hjørnet.
  useEffect(() => {
    if (!hydrated || viewMode === "results") return;
    const el = editorBoxRef.current;
    if (!el) return;
    try {
      const saved = Number(window.localStorage.getItem("sparql.editorHeight.v1"));
      if (saved >= 140) el.style.height = `${saved}px`;
    } catch {
      /* ignorér */
    }
    const ro = new ResizeObserver(() => {
      try {
        window.localStorage.setItem(
          "sparql.editorHeight.v1",
          String(Math.round(el.getBoundingClientRect().height)),
        );
      } catch {
        /* ignorér */
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [hydrated, viewMode]);

  // ── Fane-synk mot Supabase når innlogget ──────────────────────────────────
  useEffect(() => {
    if (!authEnabled || !user || !hydrated) {
      setRemoteReady(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const remote = await loadRemoteTabs();
        if (cancelled) return;
        if (remote && remote.tabs.length > 0) {
          setTabs(remote.tabs);
          setActiveId(
            remote.activeId && remote.tabs.some((t) => t.id === remote.activeId)
              ? remote.activeId
              : remote.tabs[0].id,
          );
        } else {
          await saveRemoteTabs(tabs, activeId);
        }
      } catch {
        /* nettverk / manglende tabell – behold lokale faner */
      } finally {
        if (!cancelled) setRemoteReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authEnabled, user?.id, hydrated]);

  useEffect(() => {
    if (!authEnabled || !user || !remoteReady) return;
    if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current);
    remoteSaveTimer.current = setTimeout(() => {
      saveRemoteTabs(tabs, activeId).catch(() => {});
    }, 800);
    return () => {
      if (remoteSaveTimer.current) clearTimeout(remoteSaveTimer.current);
    };
  }, [tabs, activeId, authEnabled, user, remoteReady]);

  const allEndpoints = useMemo<Endpoint[]>(
    () => [...BUILTIN_ENDPOINTS, ...custom],
    [custom],
  );
  const selectedEndpoint =
    allEndpoints.find((e) => e.name === endpointName) ?? BUILTIN_ENDPOINTS[0];

  const activeTab = tabs.find((t) => t.id === activeId) ?? tabs[0];
  const run = runs[activeTab.id];

  function flashNotice(msg: string) {
    setNotice(msg);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setNotice(null), 6000);
  }

  function setTabQuery(id: string, query: string) {
    setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, query } : t)));
  }

  function addTab() {
    const t: Tab = { id: newId(), name: null, query: DEFAULT_QUERY };
    setTabs((ts) => [...ts, t]);
    setActiveId(t.id);
  }

  function closeTab(id: string) {
    const idx = tabs.findIndex((t) => t.id === id);
    let next = tabs.filter((t) => t.id !== id);
    if (next.length === 0) next = [{ id: newId(), name: null, query: DEFAULT_QUERY }];
    setTabs(next);
    if (activeId === id) {
      setActiveId(next[Math.min(idx, next.length - 1)].id);
    }
    setRuns((r) => {
      const c = { ...r };
      delete c[id];
      return c;
    });
  }

  function renameTab(id: string, name: string | null) {
    setTabs((ts) => ts.map((t) => (t.id === id ? { ...t, name } : t)));
  }

  function openSavedInNewTab(sq: SavedQuery) {
    const t: Tab = { id: newId(), name: sq.title, query: sq.query };
    setTabs((ts) => [...ts, t]);
    setActiveId(t.id);
    if (sq.endpoint_name && allEndpoints.some((e) => e.name === sq.endpoint_name)) {
      setEndpointName(sq.endpoint_name);
    }
  }

  async function execute() {
    const tab = activeTab;
    const { query: prepared, added, adjusted } = ensurePrefixes(
      tab.query,
      selectedEndpoint.prefixes,
    );
    if (added.length || adjusted.length) {
      setTabQuery(tab.id, prepared);
      const parts: string[] = [];
      if (added.length) parts.push(`la til prefiks: ${added.join(", ")}`);
      if (adjusted.length)
        parts.push(`justerte ${adjusted.join(", ")} for ${selectedEndpoint.name}`);
      flashNotice(parts.join(" · "));
    }

    setRuns((r) => ({
      ...r,
      [tab.id]: {
        ...(r[tab.id] ?? {
          kind: "table",
          vars: [],
          bindings: [],
          ms: 0,
          ranAt: 0,
          capApplied: false,
          rowCap: 0,
          page: 0,
        }),
        status: "running",
        error: undefined,
      },
    }));

    if (viewMode === "editor") setViewMode("both");

    try {
      const res = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: selectedEndpoint.url, query: prepared }),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        setRuns((r) => ({
          ...r,
          [tab.id]: {
            ...r[tab.id]!,
            status: "error",
            error: errJson.error ?? `HTTP ${res.status}`,
            ms: errJson.ms ?? 0,
          },
        }));
        return;
      }

      // Suksess: body er rått SPARQL-resultat, metadata i headere.
      const hMs = Number(res.headers.get("x-query-ms")) || 0;
      let capApplied = res.headers.get("x-cap-applied") === "true";
      let rowCap = Number(res.headers.get("x-row-cap")) || 0;

      const bodyText = await res.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(bodyText);
      } catch {
        setRuns((r) => ({
          ...r,
          [tab.id]: {
            ...r[tab.id]!,
            status: "error",
            error: "Endepunktet svarte med noe annet enn JSON:\n\n" + bodyText.slice(0, 4000),
            ms: hMs,
          },
        }));
        return;
      }

      // Tål både rått resultat og det gamle {data, ms, capApplied}-formatet
      // (i tilfelle klient og proxy er ute av synk mellom to deployer).
      let data = parsed as SparqlResults;
      const wrapper = parsed as {
        data?: SparqlResults;
        ms?: number;
        capApplied?: boolean;
        rowCap?: number;
      };
      if (
        wrapper &&
        wrapper.data &&
        (wrapper.data.results !== undefined || typeof wrapper.data.boolean === "boolean")
      ) {
        data = wrapper.data;
        if (typeof wrapper.capApplied === "boolean") capApplied = wrapper.capApplied;
        if (typeof wrapper.rowCap === "number") rowCap = wrapper.rowCap;
      }
      const ms = hMs || (typeof wrapper?.ms === "number" ? wrapper.ms : 0);

      let kind: Run["kind"] = "graph";
      let vars: string[] = [];
      let bindings: Record<string, SparqlTerm>[] = [];
      let rawText: string | undefined;

      if (typeof data?.boolean === "boolean") {
        kind = "boolean";
      } else if (Array.isArray(data?.results?.bindings)) {
        kind = "table";
        vars = resultVars(data);
        bindings = data.results!.bindings;
      } else {
        rawText = JSON.stringify(data, null, 2);
      }

      setRuns((r) => ({
        ...r,
        [tab.id]: {
          status: "done",
          kind,
          vars,
          bindings,
          boolean: data?.boolean,
          rawText,
          ms,
          ranAt: Date.now(),
          capApplied,
          rowCap,
          page: 0,
        },
      }));
    } catch (e) {
      setRuns((r) => ({
        ...r,
        [tab.id]: {
          ...r[tab.id]!,
          status: "error",
          error: `Kunne ikke kontakte serveren: ${(e as Error).message}`,
        },
      }));
    }
  }

  function setPage(p: number) {
    setRuns((r) => ({ ...r, [activeTab.id]: { ...r[activeTab.id]!, page: p } }));
  }

  function downloadCsv() {
    if (!run || run.kind !== "table") return;
    const csv = toCsv(run.vars, run.bindings);
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(activeTab.name ?? "sparql").replace(/[^\w.-]+/g, "_")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (!hydrated) {
    return <div className="p-6 text-muted">Laster …</div>;
  }

  const total = run?.kind === "table" ? run.bindings.length : 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(run?.page ?? 0, pageCount - 1);
  const from = total === 0 ? 0 : page * PAGE_SIZE + 1;
  const to = Math.min((page + 1) * PAGE_SIZE, total);
  const pageRows =
    run?.kind === "table" ? run.bindings.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) : [];

  const showEditor = viewMode !== "results";
  const showResults = viewMode !== "editor";

  return (
    <div className="flex flex-col min-h-screen">
      {/* Topplinje */}
      <header className="flex items-center justify-between gap-4 px-5 py-3 border-b border-border flex-wrap">
        <h1 className="text-lg font-semibold">SPARQL-workbench for Grep</h1>
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex rounded border border-border overflow-hidden text-sm">
            {(["editor", "both", "results"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={
                  "px-3 py-1 " +
                  (viewMode === m ? "bg-accent text-black" : "hover:bg-panel-2")
                }
              >
                {VIEW_LABELS[m]}
              </button>
            ))}
          </div>
          <EndpointBar
            builtin={BUILTIN_ENDPOINTS}
            custom={custom}
            selectedName={selectedEndpoint.name}
            onSelect={setEndpointName}
            onSaveCustom={setCustom}
          />
          <AuthBar />
        </div>
      </header>

      {/* Faner */}
      <div className="px-5 pt-2 border-b border-border">
        <Tabs
          tabs={tabs}
          activeId={activeTab.id}
          onSelect={setActiveId}
          onAdd={addTab}
          onRename={renameTab}
          onClose={closeTab}
        />
      </div>

      <main className="flex-1 flex flex-col gap-3 p-5">
        {/* Editor */}
        {showEditor && (
          <section className="flex flex-col">
            <div
              ref={editorBoxRef}
              className={
                "resize-y overflow-auto min-h-[140px] max-h-[85vh] border border-border rounded-t bg-panel " +
                (showResults ? "h-80" : "h-[calc(100vh-13rem)]")
              }
            >
              <SparqlEditor
                key={activeTab.id}
                value={activeTab.query}
                onChange={(v) => setTabQuery(activeTab.id, v)}
                onRun={execute}
              />
            </div>
            <div className="flex items-center justify-between gap-3 px-3 py-2 border border-t-0 border-border rounded-b bg-panel">
              <div className="flex items-center gap-3 min-w-0">
                <SavedQueriesMenu
                  currentQuery={activeTab.query}
                  currentTitle={activeTab.name}
                  currentEndpointName={selectedEndpoint.name}
                  onOpen={openSavedInNewTab}
                />
                <span className="text-xs text-muted truncate hidden sm:block">
                  {notice ?? "Ctrl/⌘ + Enter for å kjøre · dra i nedre høyre hjørne for høyde"}
                </span>
              </div>
              <button
                onClick={execute}
                disabled={run?.status === "running"}
                className="bg-accent text-black rounded px-4 py-1.5 text-sm font-semibold hover:brightness-110 disabled:opacity-60 shrink-0"
              >
                {run?.status === "running" ? "Kjører …" : "Kjør"}
              </button>
            </div>
          </section>
        )}

        {/* Resultater */}
        {showResults && (
          <section className="flex flex-col gap-2">
            {/* CSV + paginering */}
            <div className="flex items-center justify-between gap-3">
              <button
                onClick={downloadCsv}
                disabled={!run || run.kind !== "table" || run.bindings.length === 0}
                className="border border-border rounded px-3 py-1 text-sm hover:bg-panel-2 disabled:opacity-40"
              >
                Last ned som CSV
              </button>
              {run?.kind === "table" && (
                <Pagination page={page} pageCount={pageCount} onChange={setPage} />
              )}
            </div>

            {/* Statuslinje */}
            {run?.status === "done" && run.kind === "table" && (
              <div className="text-xs text-muted text-right">
                Viser resultater fra {nf.format(from)} til {nf.format(to)} av{" "}
                {nf.format(total)}. Spørringen tok {sf.format(run.ms / 1000)} sek,{" "}
                {fmtDateTime(run.ranAt)}
              </div>
            )}

            {run?.capApplied && run.status === "done" && total >= run.rowCap && (
              <div className="text-xs rounded border px-3 py-2"
                style={{
                  background: "var(--panel-2)",
                  borderColor: "var(--accent)",
                  color: "var(--accent-hover)",
                }}
              >
                Resultatet er avkortet til {nf.format(run.rowCap)} rader. Legg til en egen
                LIMIT eller snevre inn spørringen for å se alt.
              </div>
            )}

            <div>
              {!run && (
                <p className="text-muted text-sm">Kjør en spørring for å se resultater.</p>
              )}
              {run?.status === "running" && (
                <p className="text-muted text-sm">Kjører spørring …</p>
              )}
              {run?.status === "error" && (
                <pre
                  className="text-sm whitespace-pre-wrap rounded border p-3 overflow-auto"
                  style={{
                    background: "var(--danger-bg)",
                    borderColor: "var(--danger-border)",
                    color: "var(--danger-fg)",
                  }}
                >
                  {run.error}
                </pre>
              )}
              {run?.status === "done" && run.kind === "boolean" && (
                <p className="text-lg font-mono">{String(run.boolean)}</p>
              )}
              {run?.status === "done" && run.kind === "graph" && (
                <div className="space-y-2">
                  <p className="text-sm text-muted">
                    Resultatet er en graf (CONSTRUCT/DESCRIBE). Viser rå respons:
                  </p>
                  <pre className="text-xs whitespace-pre-wrap rounded border border-border p-3 bg-panel overflow-auto">
                    {run.rawText}
                  </pre>
                </div>
              )}
              {run?.status === "done" && run.kind === "table" && total === 0 && (
                <p className="text-muted text-sm">Ingen treff.</p>
              )}
              {run?.status === "done" && run.kind === "table" && total > 0 && (
                <ResultsTable vars={run.vars} rows={pageRows} startNumber={from} />
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
