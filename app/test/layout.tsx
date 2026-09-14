import type { Metadata } from "next";
import "./fuseki-test.css";

export const metadata: Metadata = {
  title: "Fuseki-test — GraphDB vs Jena Fuseki",
  description:
    "Kjør en SPARQL-spørring mot begge endepunkter og sammenlign ytelse, responstid og responsinnhold.",
};

export default function FusekiTestLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="border-b border-border">
        <div className="flex items-center justify-end gap-3 px-5 pt-2 pb-1 text-sm">
          <a
            href="/"
            className="border border-border rounded px-3 py-1 text-sm hover:bg-panel-2"
          >
            ← Til Workbench
          </a>
        </div>
        <div className="px-5 pb-3">
          <h1 className="text-lg font-semibold">SPARQL-workbench for Grep</h1>
          <p className="text-sm text-muted">Benchmark-test</p>
        </div>
      </header>
      <div className="fuseki-test">{children}</div>
    </>
  );
}
