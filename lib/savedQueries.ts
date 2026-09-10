"use client";

import { getSupabase } from "./supabase/client";

export type SavedQuery = {
  id: string;
  title: string;
  query: string;
  endpoint_name: string | null;
  updated_at: string;
};

export async function listSavedQueries(): Promise<SavedQuery[]> {
  const { data, error } = await getSupabase()
    .from("saved_queries")
    .select("id, title, query, endpoint_name, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as SavedQuery[];
}

export async function createSavedQuery(input: {
  title: string;
  query: string;
  endpoint_name: string | null;
}): Promise<SavedQuery> {
  const supabase = getSupabase();
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("saved_queries")
    .insert({ ...input, user_id: auth.user!.id })
    .select("id, title, query, endpoint_name, updated_at")
    .single();
  if (error) throw error;
  return data as SavedQuery;
}

export async function updateSavedQuery(
  id: string,
  patch: Partial<Pick<SavedQuery, "title" | "query" | "endpoint_name">>,
): Promise<void> {
  const { error } = await getSupabase().from("saved_queries").update(patch).eq("id", id);
  if (error) throw error;
}

export async function deleteSavedQuery(id: string): Promise<void> {
  const { error } = await getSupabase().from("saved_queries").delete().eq("id", id);
  if (error) throw error;
}
