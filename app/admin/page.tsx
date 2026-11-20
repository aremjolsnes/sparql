"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { useAuth } from "@/components/AuthProvider";
import Boble from "@/components/Boble";
import { useAvvik } from "@/lib/useAvvik";

type AdminUser = {
  id: string;
  email: string;
  role: string;
  created_at: string;
  last_sign_in_at: string | null;
  /** Har satt sitt eget passord = tatt tjenesten i bruk */
  active: boolean;
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

  // Første henting. Tilstanden settes først når svaret kommer, ikke i selve effekten.
  useEffect(() => {
    if (loading || !isAdmin || !accessToken) return;
    let avbrutt = false;
    api("GET").then(
      (json) => {
        if (!avbrutt) setUsers(json.users ?? []);
      },
      (e) => {
        if (!avbrutt) setErr((e as Error).message);
      },
    );
    return () => {
      avbrutt = true;
    };
  }, [loading, isAdmin, accessToken, api]);

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
        <Link href="/" className="text-link hover:underline text-sm">
          Tilbake til workbench
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Admin</h1>
        <Link href="/" className="text-link hover:underline text-sm">
          Til workbench
        </Link>
      </div>

      <AvvikPanel accessToken={accessToken} />

      <h2 className="text-base font-semibold pt-2">Brukere</h2>

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
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    {u.active && (
                      <span
                        title="Har satt eget passord – tatt tjenesten i bruk"
                        aria-label="Aktiv bruker"
                        style={{ color: "#3fb950" }}
                      >
                        ✓
                      </span>
                    )}
                    {u.email}
                  </span>
                </td>
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

/** Markdown fra GitHub-issuen: en overskrift og en tabell per kontroll */
const markdownKomponenter: Components = {
  h3: ({ children }) => <h3 className="text-sm font-semibold mt-4">{children}</h3>,
  p: ({ children }) => <p className="text-sm leading-relaxed">{children}</p>,
  a: ({ href, children }) => (
    <a href={href} className="text-link hover:underline" target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
  code: ({ children }) => (
    <code className="font-mono text-[0.85em] rounded bg-panel-2 px-1 py-0.5">{children}</code>
  ),
  table: ({ children }) => (
    <div className="overflow-auto">
      <table className="text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border border-border bg-panel-2 px-2 py-1 text-left font-semibold">{children}</th>
  ),
  td: ({ children }) => <td className="border border-border px-2 py-1 align-top">{children}</td>,
};

/**
 * Åpne issues i sandkasse-repoet, først og fremst «Avvik i Grep-dataene» fra den nattlige
 * innlastingen. GitHub varsler den som er tildelt, men e-posten kommer ikke alltid fram, så
 * admin-siden viser det samme. Lukkes issuen (ingen avvik lenger), forsvinner den herfra.
 */
function AvvikPanel({ accessToken }: { accessToken: string | null | undefined }) {
  const { issues, url, feil } = useAvvik(accessToken);

  return (
    <section className="space-y-3">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-semibold">
          Åpne avvik i Grep-dataene
          {issues && issues.length > 0 && <Boble antall={issues.length} />}
        </h2>
        {url && (
          <a href={url} className="text-link hover:underline text-xs" target="_blank" rel="noopener noreferrer">
            Alle issues på GitHub
          </a>
        )}
      </div>
      <p className="text-xs text-muted">
        Den nattlige innlastingen til sandkassen melder data som bør sjekkes i Grep som åpne issues i
        repoet. Issuen oppdateres når avvikene endrer seg, og lukkes når alt er rettet.
      </p>

      {feil && (
        <p
          className="text-sm rounded border px-3 py-2"
          style={{
            background: "var(--danger-bg)",
            borderColor: "var(--danger-border)",
            color: "var(--danger-fg)",
          }}
        >
          Klarte ikke å hente issues: {feil}
        </p>
      )}
      {!feil && issues === null && <p className="text-sm text-muted">Henter fra GitHub …</p>}
      {issues && issues.length === 0 && (
        <p className="text-sm rounded border border-border bg-panel px-3 py-2">
          Ingen åpne avvik. Siste innlasting fant ingenting som må ses på.
        </p>
      )}
      {issues?.map((i) => (
        <details key={i.number} open className="border border-border rounded bg-panel">
          <summary className="cursor-pointer px-4 py-2 text-sm flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <a
              href={i.url}
              className="text-link hover:underline font-medium"
              target="_blank"
              rel="noopener noreferrer"
            >
              #{i.number} {i.title}
            </a>
            <span className="text-xs text-muted">
              oppdatert {new Date(i.updated_at).toLocaleString("nb-NO")}
              {" · "}
              {i.comments === 1 ? "1 kommentar" : `${i.comments} kommentarer`}
              {i.assignees.length > 0 && ` · tildelt ${i.assignees.join(", ")}`}
            </span>
          </summary>
          <div className="px-4 pb-4 space-y-2 border-t border-border pt-3">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownKomponenter}>
              {i.body}
            </ReactMarkdown>
          </div>
        </details>
      ))}
    </section>
  );
}
