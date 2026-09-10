"use client";

import { SparqlTerm } from "@/lib/sparql";

type Props = {
  vars: string[];
  rows: Record<string, SparqlTerm>[];
  /** 1-indeksert nummer på første rad i utsnittet */
  startNumber: number;
};

function shortDatatype(iri: string): string {
  const m = iri.match(/[#/]([^#/]+)$/);
  return m ? m[1] : iri;
}

function Cell({ term }: { term: SparqlTerm | undefined }) {
  if (!term) return <span className="text-muted">–</span>;

  if (term.type === "uri") {
    return (
      <a
        href={term.value}
        target="_blank"
        rel="noreferrer"
        className="text-link hover:underline break-all"
      >
        {term.value}
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

export default function ResultsTable({ vars, rows, startNumber }: Props) {
  return (
    <div className="overflow-x-auto border border-border rounded">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-panel-2">
            <th className="text-right px-3 py-2 border-b border-border text-muted font-medium w-12">
              #
            </th>
            {vars.map((v) => (
              <th
                key={v}
                className="text-left px-3 py-2 border-b border-border font-semibold whitespace-nowrap"
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
                  <Cell term={row[v]} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
