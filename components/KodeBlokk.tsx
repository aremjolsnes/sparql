"use client";

import { useRef, useState } from "react";

/**
 * En kodeblokk med kopier-knapp (ikon) øverst til høyre. Knappen kopierer teksten i blokken, og
 * viser en grønn hake et par sekunder etterpå.
 */
export default function KodeBlokk({
  children,
  className = "",
}: {
  children: React.ReactNode;
  /** Ekstra klasser på <pre>, for eksempel whitespace-pre-wrap */
  className?: string;
}) {
  const pre = useRef<HTMLPreElement | null>(null);
  const [kopiert, setKopiert] = useState(false);

  async function kopier() {
    try {
      // Uten linjeskiftet til slutt, så en kommando ikke kjøres idet den limes inn i en terminal
      await navigator.clipboard.writeText((pre.current?.textContent ?? "").replace(/\n+$/, ""));
      setKopiert(true);
      setTimeout(() => setKopiert(false), 2000);
    } catch {
      // Utklippstavlen er ikke tilgjengelig (for eksempel uten https). Da skjer ingenting.
    }
  }

  return (
    <div className="relative group">
      <pre
        ref={pre}
        className={`text-xs font-mono rounded border border-border bg-panel-2 p-3 overflow-auto ${className}`}
      >
        {children}
      </pre>
      <button
        type="button"
        onClick={kopier}
        aria-label={kopiert ? "Kopiert" : "Kopier koden"}
        title={kopiert ? "Kopiert" : "Kopier"}
        className="absolute top-1.5 right-1.5 rounded border border-border bg-panel p-1.5 text-muted hover:text-foreground hover:bg-panel-2 opacity-70 group-hover:opacity-100 focus:opacity-100"
      >
        <svg
          viewBox="0 0 16 16"
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={kopiert ? { color: "#4ade80" } : undefined}
        >
          {kopiert ? (
            // Hake: kopiert
            <path d="M3 8.5l3.5 3.5L13 4.5" />
          ) : (
            // To ark oppå hverandre: kopier
            <>
              <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
              <path d="M10.5 5.5v-2a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 3.5v5A1.5 1.5 0 0 0 4 10h1.5" />
            </>
          )}
        </svg>
      </button>
    </div>
  );
}
