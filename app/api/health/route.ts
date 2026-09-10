import { adminConfigured, secretClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

/**
 * Enkel helsesjekk. Gjør et lite DB-kall slik at Supabase teller aktivitet og
 * gratis-prosjektet ikke pauses etter 7 dager. Kalles av Vercel Cron.
 */
export async function GET() {
  if (!adminConfigured()) {
    return Response.json({ ok: false, db: "unconfigured", ts: Date.now() });
  }
  const { error } = await secretClient().from("profiles").select("id").limit(1);
  return Response.json({ ok: !error, db: error ? "error" : "ok", ts: Date.now() });
}
