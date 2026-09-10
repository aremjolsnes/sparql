"use client";

type Props = {
  page: number; // 0-indeksert
  pageCount: number;
  onChange: (page: number) => void;
};

/** Bygger sidelisten med ellipser når det er mange sider. */
function pageList(page: number, pageCount: number): (number | "…")[] {
  if (pageCount <= 12) {
    return Array.from({ length: pageCount }, (_, i) => i);
  }
  const out = new Set<number>([0, pageCount - 1, page]);
  for (let d = 1; d <= 2; d++) {
    out.add(Math.max(0, page - d));
    out.add(Math.min(pageCount - 1, page + d));
  }
  const sorted = [...out].sort((a, b) => a - b);
  const result: (number | "…")[] = [];
  let prev = -1;
  for (const n of sorted) {
    if (prev !== -1 && n - prev > 1) result.push("…");
    result.push(n);
    prev = n;
  }
  return result;
}

export default function Pagination({ page, pageCount, onChange }: Props) {
  if (pageCount <= 1) return null;
  const items = pageList(page, pageCount);

  return (
    <nav className="flex items-center gap-1 text-sm" aria-label="Paginering">
      {items.map((it, i) =>
        it === "…" ? (
          <span key={`e${i}`} className="px-1 text-muted select-none">
            …
          </span>
        ) : it === page ? (
          <span
            key={it}
            aria-current="page"
            className="px-2 py-0.5 rounded bg-accent text-black font-medium"
          >
            {it + 1}
          </span>
        ) : (
          <button
            key={it}
            onClick={() => onChange(it)}
            className="px-2 py-0.5 rounded text-link hover:bg-panel-2"
          >
            {it + 1}
          </button>
        ),
      )}
    </nav>
  );
}
