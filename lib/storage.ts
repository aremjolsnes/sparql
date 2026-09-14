"use client";

import { Endpoint } from "./endpoints";

export type Tab = {
  id: string;
  /** null = «Uten navn» (vises i grått) */
  name: string | null;
  query: string;
};

export type ViewMode = "editor" | "both" | "results";

const K_TABS = "sparql.tabs.v1";
const K_TABS_UPDATED_AT = "sparql.tabs.updatedAt.v1";
const K_ACTIVE = "sparql.activeTab.v1";
const K_VIEW = "sparql.viewMode.v1";
const K_ENDPOINT = "sparql.endpointName.v1";
const K_CUSTOM = "sparql.customEndpoints.v1";

export const DEFAULT_QUERY = `SELECT * WHERE {
  ?s ?p ?o
}
LIMIT 100`;

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* full/utilgjengelig lagring – ignorér */
  }
}

export function newId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function loadTabs(): { tabs: Tab[]; activeId: string } {
  let tabs = read<Tab[]>(K_TABS, []);
  if (!Array.isArray(tabs) || tabs.length === 0) {
    tabs = [{ id: newId(), name: null, query: DEFAULT_QUERY }];
  }
  let activeId = read<string>(K_ACTIVE, tabs[0].id);
  if (!tabs.some((t) => t.id === activeId)) activeId = tabs[0].id;
  return { tabs, activeId };
}

export const saveTabs = (tabs: Tab[]) => {
  write(K_TABS, tabs);
  write(K_TABS_UPDATED_AT, Date.now());
};
/** Tidspunkt (ms) for siste lokale fane-lagring – brukt til å avgjøre om lokalt eller
 * eksternt (Supabase) er nyest når begge finnes, se app/page.tsx sin fane-synk. 0 hvis
 * ingenting er lagret lokalt ennå. */
export const loadTabsUpdatedAt = (): number => read<number>(K_TABS_UPDATED_AT, 0);
export const saveActiveId = (id: string) => write(K_ACTIVE, id);

export const loadViewMode = (): ViewMode => read<ViewMode>(K_VIEW, "both");
export const saveViewMode = (v: ViewMode) => write(K_VIEW, v);

export const loadEndpointName = (): string | null => read<string | null>(K_ENDPOINT, null);
export const saveEndpointName = (name: string) => write(K_ENDPOINT, name);

export const loadCustomEndpoints = (): Endpoint[] => {
  const list = read<Endpoint[]>(K_CUSTOM, []);
  return Array.isArray(list) ? list.filter((e) => e && e.name && e.url) : [];
};
export const saveCustomEndpoints = (list: Endpoint[]) => write(K_CUSTOM, list);
