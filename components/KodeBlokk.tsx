"use client";

import { useRef, useState } from "react";

/**
 * En kodeblokk med «Kopier»-knapp øverst til høyre. Knappen kopierer teksten i blokken slik den
 * står, og viser «Kopiert» et par sekunder etterpå.
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
        aria-label="Kopier koden"
        className="absolute top-1.5 right-1.5 rounded border border-border bg-panel px-2 py-0.5 text-xs text-muted hover:text-foreground hover:bg-panel-2 opacity-70 group-hover:opacity-100 focus:opacity-100"
      >
        {kopiert ? "Kopiert" : "Kopier"}
      </button>
    </div>
  );
}
