"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
};

export default function AdminPage() {
  const { enabled, loading, user, profile, accessToken } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"member" | "admin">("member");

  const isAdmin = profile?.role === "admin";

  const api = useCallback(
    async (method: string, body?: unknown) => {
      const res = await fetch("/api/admin/users", {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken ?? ""}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      return json;
    },
    [accessToken],
  );

  const refresh = useCallback(async () => {
    setErr(null);
    try {
      const json = await api("GET");
      setUsers(json.users ?? []);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [api]);

  useEffect(() => {
    if (!loading && isAdmin && accessToken) refresh();
  }, [loading, isAdmin, accessToken, refresh]);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      await api("POST", { email: email.trim(), password, role });
      setEmail("");
      setPassword("");
      setRole("member");
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword(u: AdminUser) {
    const pw = window.prompt(`Nytt passord for ${u.email} (min. 8 tegn):`);
    if (!pw) return;
    try {
      await api("PATCH", { userId: u.id, password: pw });
      alert("Passord oppdatert.");
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function toggleRole(u: AdminUser) {
    const next = u.role === "admin" ? "member" : "admin";
    if (!window.confirm(`Sette ${u.email} som ${next}?`)) return;
    try {
      await api("PATCH", { userId: u.id, role: next });
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  async function removeUser(u: AdminUser) {
    if (!window.confirm(`Slette ${u.email}? Dette kan ikke angres.`)) return;
    try {
      await api("DELETE", { userId: u.id });
      await refresh();
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  if (loading) return <div className="p-6 text-muted">Laster …</div>;

  if (!enabled) {
    return <div className="p-6 text-muted">Innlogging er ikke satt opp i dette miljøet.</div>;
  }

  if (!user || !isAdmin) {
    return (
      <div className="p-6 space-y-2">
        <p className="text-sm">Du har ikke tilgang til denne siden.</p>
        <a href="/" className="text-link hover:underline text-sm">
          Tilbake til workbench
        </a>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Brukere</h1>
        <a href="/" className="text-link hover:underline text-sm">
          Til workbench
        </a>
      </div>

      {err && (
        <p className="text-sm rounded border px-3 py-2"
          style={{
            background: "var(--danger-bg)",
            borderColor: "var(--danger-border)",
            color: "var(--danger-fg)",
          }}
        >
          {err}
        </p>
      )}

      <form
        onSubmit={createUser}
        className="border border-border rounded bg-panel p-4 space-y-3"
      >
        <div className="text-sm font-medium">Ny bruker</div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="email"
            required
            placeholder="E-post"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="bg-panel-2 border border-border rounded px-2 py-1.5 text-sm"
          />
          <input
            type="text"
            required
            placeholder="Midlertidig passord (min. 8)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="bg-panel-2 border border-border rounded px-2 py-1.5 text-sm"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "member" | "admin")}
            className="bg-panel-2 border border-border rounded px-2 py-1.5 text-sm"
          >
            <option value="member">member</option>
            <option value="admin">admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="bg-accent text-black rounded px-3 py-1.5 text-sm font-semibold hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Oppretter …" : "Opprett bruker"}
        </button>
        <p className="text-xs text-muted">
          Brukeren logger inn med e-post + dette passordet og kan bytte passord selv etterpå.
        </p>
      </form>

      <div className="border border-border rounded overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-panel-2">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">E-post</th>
              <th className="text-left px-3 py-2 font-semibold">Rolle</th>
              <th className="text-left px-3 py-2 font-semibold">Sist innlogget</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-border">
                <td className="px-3 py-2">{u.email}</td>
                <td className="px-3 py-2">{u.role}</td>
                <td className="px-3 py-2 text-muted">
                  {u.last_sign_in_at
                    ? new Date(u.last_sign_in_at).toLocaleString("nb-NO")
                    : "aldri"}
                </td>
                <td className="px-3 py-2">
                  <div className="flex gap-3 justify-end text-xs">
                    <button onClick={() => resetPassword(u)} className="text-link hover:underline">
                      Nytt passord
                    </button>
                    <button onClick={() => toggleRole(u)} className="text-link hover:underline">
                      {u.role === "admin" ? "Gjør til member" : "Gjør til admin"}
                    </button>
                    <button
                      onClick={() => removeUser(u)}
                      className="hover:underline"
                      style={{ color: "var(--danger-fg)" }}
                    >
                      Slett
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-muted text-center">
                  Ingen brukere ennå.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
