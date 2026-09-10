"use client";

import { useEffect, useRef, useState } from "react";
import { Tab } from "@/lib/storage";

type Props = {
  tabs: Tab[];
  activeId: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onRename: (id: string, name: string | null) => void;
  onClose: (id: string) => void;
};

export default function Tabs({ tabs, activeId, onSelect, onAdd, onRename, onClose }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingId) inputRef.current?.select();
  }, [editingId]);

  function startEdit(tab: Tab) {
    setEditingId(tab.id);
    setDraft(tab.name ?? "");
  }

  function commit() {
    if (editingId) {
      const trimmed = draft.trim();
      onRename(editingId, trimmed === "" ? null : trimmed);
    }
    setEditingId(null);
  }

  return (
    <div className="flex items-end gap-1 overflow-x-auto">
      {tabs.map((tab) => {
        const active = tab.id === activeId;
        return (
          <div
            key={tab.id}
            onClick={() => onSelect(tab.id)}
            onDoubleClick={() => startEdit(tab)}
            title="Dobbeltklikk for å gi fanen et navn"
            className={[
              "group flex items-center gap-2 px-3 py-1.5 rounded-t border cursor-pointer text-sm whitespace-nowrap",
              active
                ? "bg-panel border-border border-b-panel text-foreground"
                : "bg-panel-2/60 border-transparent text-muted hover:text-foreground",
            ].join(" ")}
          >
            {editingId === tab.id ? (
              <input
                ref={inputRef}
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onBlur={commit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commit();
                  if (e.key === "Escape") setEditingId(null);
                }}
                className="bg-panel-2 border border-border rounded px-1 py-0.5 text-sm w-32"
              />
            ) : (
              <span className={tab.name ? "" : "italic text-muted"}>
                {tab.name ?? "Uten navn"}
              </span>
            )}
            {tabs.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onClose(tab.id);
                }}
                className="opacity-0 group-hover:opacity-100 text-muted hover:text-foreground"
                aria-label="Lukk fane"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
      <button
        onClick={onAdd}
        className="px-2 py-1.5 text-muted hover:text-foreground text-sm"
        aria-label="Ny fane"
        title="Ny fane"
      >
        +
      </button>
    </div>
  );
}
