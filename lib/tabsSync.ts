"use client";

import { getSupabase } from "./supabase/client";
import { Tab } from "./storage";

export type RemoteTabs = { tabs: Tab[]; activeId: string | null; updatedAt: string } | null;

/** Henter brukerens lagrede faner fra Supabase. null = ingen rad ennå. */
export async function loadRemoteTabs(): Promise<RemoteTabs> {
  const { data, error } = await getSupabase()
    .from("user_tabs")
    .select("data, active_id, updated_at")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const tabs = Array.isArray(data.data) ? (data.data as Tab[]) : [];
  return { tabs, activeId: (data.active_id as string | null) ?? null, updatedAt: data.updated_at as string };
}

/** Lagrer (upsert) brukerens faner. */
export async function saveRemoteTabs(tabs: Tab[], activeId: string): Promise<void> {
  const supabase = getSupabase();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return;
  const { error } = await supabase
    .from("user_tabs")
    .upsert(
      { user_id: auth.user.id, data: tabs, active_id: activeId },
      { onConflict: "user_id" },
    );
  if (error) throw error;
}
