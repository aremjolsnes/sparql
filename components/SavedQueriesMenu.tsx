"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import {
  SavedQuery,
  createSavedQuery,
  deleteSavedQuery,
  listSavedQueries,
  updateSavedQuery,
} from "@/lib/savedQueries";

type Props = {
  /** Gjeldende spørring og fane-navn (for «Lagre») */
  currentQuery: string;
  currentTitle: string | null;
  currentEndpointName: string;
  /** Åpne en lagret spørring i ny fane */
  onOpen: (sq: SavedQuery) => void;
};

export default function SavedQueriesMenu({
  currentQuery,
  currentTitle,
  currentEndpointName,
  onOpen,
}: Props) {
  const { enabled, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<SavedQuery[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    setErr(null);
    setLoading(true);
    try {
      setItems(await listSavedQueries());
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!enabled || !user) return null;

  async function save() {
    const fallback = currentQuery.split("\n").find((l) => l.trim())?.slice(0, 60) ?? "Uten navn";
    const title = window.prompt("Tittel på spørringen:", currentTitle || fallback);
    if (!title) return;
    try {
      await createSavedQuery({
        title: title.trim(),
        query: currentQuery,
        endpoint_name: currentEndpointName || null,
      });
      if (open) refresh();
      else setOpen(true);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function rename(sq: SavedQuery) {
    const title = window.prompt("Nytt navn:", sq.title);
    if (!title || title.trim() === sq.title) return;
    try {
      await updateSavedQuery(sq.id, { title: title.trim() });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function overwrite(sq: SavedQuery) {
    if (!window.confirm(`Overskrive «${sq.title}» med gjeldende spørring?`)) return;
    try {
      await updateSavedQuery(sq.id, {
        query: currentQuery,
        endpoint_name: currentEndpointName || null,
      });
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function remove(sq: SavedQuery) {
    if (!window.confirm(`Slette «${sq.title}»?`)) return;
    try {
      await deleteSavedQuery(sq.id);
      refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  return (
    <div className="relative" ref={boxRef}>
      <div className="flex items-center gap-1">
        <button
          onClick={save}
          className="border border-border rounded px-3 py-1 text-sm hover:bg-panel-2"
        >
          Lagre spørring
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          className="border border-border rounded px-2 py-1 text-sm hover:bg-panel-2"
          aria-label="Lagrede spørringer"
        >
          Lagrede ▾
        </button>
      </div>

      {open && (
        <div className="absolute left-0 bottom-full mb-1 w-96 max-w-[calc(100vw-2rem)] max-h-[50vh] overflow-auto z-40 border border-border rounded bg-panel shadow-xl">
          {loading && <div className="px-3 py-2 text-sm text-muted">Laster …</div>}
          {err && (
            <div className="px-3 py-2 text-sm" style={{ color: "var(--danger-fg)" }}>
              {err}
            </div>
          )}
          {!loading && !err && items.length === 0 && (
            <div className="px-3 py-2 text-sm text-muted">Ingen lagrede spørringer.</div>
          )}
          <ul className="divide-y divide-border">
            {items.map((sq) => (
              <li key={sq.id} className="px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <button
                    onClick={() => {
                      onOpen(sq);
                      setOpen(false);
                    }}
                    className="text-left text-sm text-link hover:underline flex-1"
                    title="Åpne i ny fane"
                  >
                    {sq.title}
                  </button>
                </div>
                {sq.endpoint_name && (
                  <div className="text-xs text-muted mt-0.5">{sq.endpoint_name}</div>
                )}
                <div className="flex gap-3 mt-1 text-xs">
                  <button onClick={() => overwrite(sq)} className="text-muted hover:text-foreground">
                    Overskriv
                  </button>
                  <button onClick={() => rename(sq)} className="text-muted hover:text-foreground">
                    Gi nytt navn
                  </button>
                  <button
                    onClick={() => remove(sq)}
                    className="hover:underline"
                    style={{ color: "var(--danger-fg)" }}
                  >
                    Slett
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
