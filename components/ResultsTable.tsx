"use client";

import { useEffect, useRef, useState } from "react";
import { SparqlTerm, TermRole } from "@/lib/sparql";
import { shortenUri } from "@/lib/prefixes";

type Props = {
  vars: string[];
  rows: Record<string, SparqlTerm>[];
  /** 1-indeksert nummer på første rad i utsnittet */
  startNumber: number;
  /** Idé 9: høyreklikk-meny for å bruke en ressurslenke som s/p/o i ny fane. */
  onOpenInNewTab?: (uri: string, role: TermRole) => void;
};

function shortDatatype(iri: string): string {
  const m = iri.match(/[#/]([^#/]+)$/);
  return m ? m[1] : iri;
}

const ROLE_LABELS: Record<TermRole, string> = {
  subject: "subjekt",
  predicate: "predikat",
  object: "objekt",
};

function Cell({
  term,
  onLinkContextMenu,
}: {
  term: SparqlTerm | undefined;
  onLinkContextMenu?: (e: React.MouseEvent, uri: string) => void;
}) {
  if (!term) return <span className="text-muted">–</span>;

  if (term.type === "uri") {
    const short = shortenUri(term.value);
    return (
      <a
        href={term.value}
        target="_blank"
        rel="noreferrer"
        title={short !== term.value ? term.value : undefined}
        className="text-link hover:underline break-all"
        onContextMenu={
          onLinkContextMenu ? (e) => onLinkContextMenu(e, term.value) : undefined
        }
      >
        {short}
      </a>
    );
  }

  if (term.type === "bnode") {
    return <span className="text-muted">_:{term.value}</span>;
  }

  const lang = term["xml:lang"];
  const dt = term.datatype;
  const showDt =
    dt &&
    dt !== "http://www.w3.org/2001/XMLSchema#string" &&
    dt !== "http://www.w3.org/1999/02/22-rdf-syntax-ns#langString";

  return (
    <span className="break-words">
      {term.value}
      {lang && <span className="text-muted">{" "}@{lang}</span>}
      {showDt && <span className="text-muted">{" "}^^{shortDatatype(dt!)}</span>}
    </span>
  );
}

export default function ResultsTable({ vars, rows, startNumber, onOpenInNewTab }: Props) {
  const [menu, setMenu] = useState<{ x: number; y: number; uri: string } | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menu) return;
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenu(null);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenu(null);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menu]);

  function handleLinkContextMenu(e: React.MouseEvent, uri: string) {
    if (!onOpenInNewTab) return;
    e.preventDefault();
    const menuWidth = 240;
    const menuHeight = 150;
    setMenu({
      x: Math.min(e.clientX, window.innerWidth - menuWidth - 8),
      y: Math.min(e.clientY, window.innerHeight - menuHeight - 8),
      uri,
    });
  }

  function choose(role: TermRole) {
    if (menu && onOpenInNewTab) onOpenInNewTab(menu.uri, role);
    setMenu(null);
  }

  // Ingen overflow-container her: da fester `position: sticky` på <th> seg til
  // toppen av vinduet når hele siden skrolles (også i Firefox).
  return (
    <div className="border border-border">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th className="sticky top-0 z-20 bg-panel-2 text-right px-3 py-2 border-b border-border text-muted font-medium w-12">
              #
            </th>
            {vars.map((v) => (
              <th
                key={v}
                className="sticky top-0 z-20 bg-panel-2 text-left px-3 py-2 border-b border-border font-semibold whitespace-nowrap"
              >
                {v}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="odd:bg-panel/40 align-top">
              <td className="text-right px-3 py-1.5 border-b border-border text-muted tabular-nums">
                {startNumber + i}
              </td>
              {vars.map((v) => (
                <td key={v} className="px-3 py-1.5 border-b border-border max-w-md">
                  <Cell term={row[v]} onLinkContextMenu={handleLinkContextMenu} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {menu && (
        <div
          ref={menuRef}
          style={{ position: "fixed", top: menu.y, left: menu.x }}
          className="z-50 border border-border rounded bg-panel shadow-xl text-sm py-1 min-w-[220px]"
        >
          <div className="px-3 py-1 text-xs text-muted truncate border-b border-border mb-1" title={menu.uri}>
            {shortenUri(menu.uri)}
          </div>
          {(["subject", "predicate", "object"] as TermRole[]).map((role) => (
            <button
              key={role}
              onClick={() => choose(role)}
              className="block w-full text-left px-3 py-1.5 hover:bg-panel-2"
            >
              Bruk som {ROLE_LABELS[role]} i ny fane
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
