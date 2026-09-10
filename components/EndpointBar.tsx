"use client";

import { useState } from "react";
import { Endpoint } from "@/lib/endpoints";

type Props = {
  builtin: Endpoint[];
  custom: Endpoint[];
  selectedName: string;
  onSelect: (name: string) => void;
  onSaveCustom: (list: Endpoint[]) => void;
};

export default function EndpointBar({
  builtin,
  custom,
  selectedName,
  onSelect,
  onSaveCustom,
}: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const allNames = new Set([...builtin, ...custom].map((e) => e.name));

  function add() {
    setErr(null);
    const n = name.trim();
    const u = url.trim();
    if (!n || !u) return setErr("Fyll ut både visningsnavn og URL.");
    if (allNames.has(n)) return setErr("Det finnes allerede et endepunkt med dette navnet.");
    try {
      const parsed = new URL(u);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return setErr("URL-en må bruke http eller https.");
      }
    } catch {
      return setErr("Ugyldig URL.");
    }
    onSaveCustom([...custom, { name: n, url: u }]);
    setName("");
    setUrl("");
  }

  function remove(target: string) {
    onSaveCustom(custom.filter((e) => e.name !== target));
    if (selectedName === target) onSelect(builtin[0].name);
  }

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm text-muted">Endepunkt</label>
      <select
        value={selectedName}
        onChange={(e) => onSelect(e.target.value)}
        className="bg-panel border border-border rounded px-2 py-1 text-sm"
      >
        <optgroup label="Innebygde">
          {builtin.map((e) => (
            <option key={e.name} value={e.name}>
              {e.name}
            </option>
          ))}
        </optgroup>
        {custom.length > 0 && (
          <optgroup label="Egendefinerte">
            {custom.map((e) => (
              <option key={e.name} value={e.name}>
                {e.name}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <button
        onClick={() => setOpen(true)}
        title="Administrer endepunkter"
        aria-label="Administrer endepunkter"
        className="border border-border rounded px-2 py-1 text-sm hover:bg-panel-2"
      >
        ⚙
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-24"
          onClick={() => setOpen(false)}
        >
          <div
            className="bg-panel border border-border rounded-lg w-[560px] max-w-[92vw] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold">Endepunkter</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-muted hover:text-foreground"
                aria-label="Lukk"
              >
                ✕
              </button>
            </div>

            <ul className="space-y-1 mb-4 text-sm">
              {builtin.map((e) => (
                <li key={e.name} className="flex items-center justify-between gap-3 py-1">
                  <span>
                    <span className="font-medium">{e.name}</span>{" "}
                    <span className="text-muted break-all">{e.url}</span>
                  </span>
                  <span className="text-muted text-xs shrink-0">innebygd</span>
                </li>
              ))}
              {custom.map((e) => (
                <li key={e.name} className="flex items-center justify-between gap-3 py-1">
                  <span>
                    <span className="font-medium">{e.name}</span>{" "}
                    <span className="text-muted break-all">{e.url}</span>
                  </span>
                  <button
                    onClick={() => remove(e.name)}
                    className="text-danger shrink-0 hover:underline text-xs"
                    style={{ color: "var(--danger-fg)" }}
                  >
                    Fjern
                  </button>
                </li>
              ))}
            </ul>

            <div className="border-t border-border pt-4 space-y-2">
              <div className="text-sm font-medium">Legg til endepunkt</div>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Visningsnavn"
                className="w-full bg-panel-2 border border-border rounded px-2 py-1.5 text-sm"
              />
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…/repositories/201906"
                className="w-full bg-panel-2 border border-border rounded px-2 py-1.5 text-sm"
              />
              {err && (
                <p className="text-sm" style={{ color: "var(--danger-fg)" }}>
                  {err}
                </p>
              )}
              <button
                onClick={add}
                className="bg-accent text-black rounded px-3 py-1.5 text-sm font-medium hover:brightness-110"
              >
                Legg til
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
