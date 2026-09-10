import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.SUPABASE_SECRET_KEY;

export function adminConfigured(): boolean {
  return Boolean(URL && PUBLISHABLE && SECRET);
}

/** Klient med secret-nøkkel – forbigår RLS. Kun i server-kode. */
export function secretClient(): SupabaseClient {
  if (!URL || !SECRET) throw new Error("Supabase secret-nøkkel mangler.");
  return createClient(URL, SECRET, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type Caller = { id: string; email: string; role: "member" | "admin" };

/**
 * Validerer `Authorization: Bearer <access_token>` fra forespørselen og henter
 * kaller-brukerens profil. Returnerer null hvis token er ugyldig / mangler.
 */
export async function getCaller(req: Request): Promise<Caller | null> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7) : "";
  if (!token || !URL || !PUBLISHABLE) return null;

  const asUser = createClient(URL, PUBLISHABLE, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data, error } = await asUser.auth.getUser();
  if (error || !data.user) return null;

  const svc = secretClient();
  const { data: profile } = await svc
    .from("profiles")
    .select("role")
    .eq("id", data.user.id)
    .single();

  return {
    id: data.user.id,
    email: data.user.email ?? "",
    role: (profile?.role as Caller["role"]) ?? "member",
  };
}

export async function requireAdmin(req: Request): Promise<Caller | Response> {
  const caller = await getCaller(req);
  if (!caller) {
    return Response.json({ error: "Ikke innlogget." }, { status: 401 });
  }
  if (caller.role !== "admin") {
    return Response.json({ error: "Krever admin." }, { status: 403 });
  }
  return caller;
}
