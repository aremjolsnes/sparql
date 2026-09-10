import { NextRequest } from "next/server";
import { requireAdmin, secretClient, adminConfigured } from "@/lib/supabase/admin";

export const runtime = "nodejs";

function guard() {
  if (!adminConfigured()) {
    return Response.json({ error: "Supabase er ikke konfigurert på serveren." }, { status: 503 });
  }
  return null;
}

export async function GET(req: NextRequest) {
  const g = guard();
  if (g) return g;
  const caller = await requireAdmin(req);
  if (caller instanceof Response) return caller;

  const svc = secretClient();
  const [{ data: profiles }, listRes] = await Promise.all([
    svc.from("profiles").select("id, email, role, created_at"),
    svc.auth.admin.listUsers({ perPage: 1000 }),
  ]);

  const signInMap = new Map(
    (listRes.data?.users ?? []).map((u) => [u.id, u.last_sign_in_at ?? null]),
  );

  const users = (profiles ?? [])
    .map((p) => ({
      id: p.id as string,
      email: p.email as string,
      role: p.role as string,
      created_at: p.created_at as string,
      last_sign_in_at: signInMap.get(p.id as string) ?? null,
    }))
    .sort((a, b) => a.email.localeCompare(b.email));

  return Response.json({ users });
}

export async function POST(req: NextRequest) {
  const g = guard();
  if (g) return g;
  const caller = await requireAdmin(req);
  if (caller instanceof Response) return caller;

  const { email, password, role } = await req.json().catch(() => ({}));
  if (!email || typeof email !== "string") {
    return Response.json({ error: "Mangler e-post." }, { status: 400 });
  }
  if (!password || typeof password !== "string" || password.length < 8) {
    return Response.json({ error: "Passord må være minst 8 tegn." }, { status: 400 });
  }
  const assignedRole = role === "admin" ? "admin" : "member";

  const svc = secretClient();
  const { data, error } = await svc.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role: assignedRole },
  });
  if (error) return Response.json({ error: error.message }, { status: 400 });

  // Sikre at profilraden fikk riktig rolle (triggeren setter den, men vær eksplisitt).
  await svc.from("profiles").update({ role: assignedRole }).eq("id", data.user.id);

  return Response.json({ ok: true, id: data.user.id });
}

export async function PATCH(req: NextRequest) {
  const g = guard();
  if (g) return g;
  const caller = await requireAdmin(req);
  if (caller instanceof Response) return caller;

  const { userId, password, role } = await req.json().catch(() => ({}));
  if (!userId || typeof userId !== "string") {
    return Response.json({ error: "Mangler userId." }, { status: 400 });
  }

  const svc = secretClient();

  if (password) {
    if (typeof password !== "string" || password.length < 8) {
      return Response.json({ error: "Passord må være minst 8 tegn." }, { status: 400 });
    }
    const { error } = await svc.auth.admin.updateUserById(userId, { password });
    if (error) return Response.json({ error: error.message }, { status: 400 });
  }

  if (role) {
    if (userId === caller.id) {
      return Response.json({ error: "Du kan ikke endre din egen rolle." }, { status: 400 });
    }
    const assignedRole = role === "admin" ? "admin" : "member";
    const { error } = await svc.from("profiles").update({ role: assignedRole }).eq("id", userId);
    if (error) return Response.json({ error: error.message }, { status: 400 });
  }

  return Response.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const g = guard();
  if (g) return g;
  const caller = await requireAdmin(req);
  if (caller instanceof Response) return caller;

  const { userId } = await req.json().catch(() => ({}));
  if (!userId || typeof userId !== "string") {
    return Response.json({ error: "Mangler userId." }, { status: 400 });
  }
  if (userId === caller.id) {
    return Response.json({ error: "Du kan ikke slette din egen bruker." }, { status: 400 });
  }

  const svc = secretClient();
  const { error } = await svc.auth.admin.deleteUser(userId);
  if (error) return Response.json({ error: error.message }, { status: 400 });
  return Response.json({ ok: true });
}
