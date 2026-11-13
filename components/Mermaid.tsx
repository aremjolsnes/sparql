"use client";

import { useEffect, useId, useState } from "react";

/**
 * Tegner et Mermaid-diagram (```mermaid-blokker i dokumentasjonen). Biblioteket er stort og lastes
 * derfor først når en side faktisk har et diagram. Til diagrammet er tegnet, og hvis det ikke lar
 * seg tegne, vises kildeteksten.
 */
export default function Mermaid({ kode }: { kode: string }) {
  const id = `mermaid-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [svg, setSvg] = useState<string | null>(null);

  useEffect(() => {
    let avbrutt = false;
    (async () => {
      try {
        const { default: mermaid } = await import("mermaid");
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "strict",
          theme: "base",
          fontFamily: 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
          // Fargene i appens mørke tema (app/globals.css)
          themeVariables: {
            darkMode: true,
            background: "#0f1115",
            primaryColor: "#1c222c",
            primaryBorderColor: "#4a5568",
            primaryTextColor: "#e6e9ef",
            secondaryColor: "#161a21",
            tertiaryColor: "#161a21",
            lineColor: "#8b95a5",
            textColor: "#e6e9ef",
            clusterBkg: "#161a21",
            clusterBorder: "#2a323f",
            edgeLabelBackground: "#0f1115",
            fontSize: "14px",
          },
        });
        const { svg } = await mermaid.render(id, kode);
        if (!avbrutt) setSvg(svg);
      } catch {
        if (!avbrutt) setSvg(null);
      }
    })();
    return () => {
      avbrutt = true;
    };
  }, [id, kode]);

  if (svg === null) {
    return (
      <pre className="text-xs font-mono rounded border border-border bg-panel-2 p-3 overflow-auto">
        {kode}
      </pre>
    );
  }
  return (
    <div
      className="rounded border border-border bg-background p-3 overflow-auto [&>svg]:mx-auto [&>svg]:h-auto [&>svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
