"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

/** Er Supabase konfigurert i dette miljøet? */
export function supabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}

/** Browser-klient (singleton). Kaster hvis Supabase ikke er konfigurert. */
export function getSupabase(): SupabaseClient {
  if (!supabaseConfigured()) {
    throw new Error("Supabase er ikke konfigurert (mangler NEXT_PUBLIC_SUPABASE_*).");
  }
  if (!cached) {
    cached = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    );
  }
  return cached;
}
