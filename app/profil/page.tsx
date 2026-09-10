"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function ProfilPage() {
  const { enabled, loading, user, profile, changePassword, signOut } = useAuth();
  const router = useRouter();

  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && enabled && !user) router.replace("/login");
  }, [loading, enabled, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(false);
    if (pw.length < 8) return setErr("Minst 8 tegn.");
    if (pw !== pw2) return setErr("Passordene er ikke like.");
    setBusy(true);
    const { error } = await changePassword(pw);
    setBusy(false);
    if (error) return setErr(error);
    setPw("");
    setPw2("");
    setOk(true);
  }

  if (loading) return <div className="p-6 text-muted">Laster …</div>;
  if (!enabled) {
    return <div className="p-6 text-muted">Innlogging er ikke satt opp i dette miljøet.</div>;
  }
  if (!user) return null;

  return (
    <div className="max-w-md mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Profil</h1>
        <a href="/" className="text-link hover:underline text-sm">
          Til workbench
        </a>
      </div>

      <dl className="text-sm border border-border rounded bg-panel divide-y divide-border">
        <div className="flex justify-between px-3 py-2">
          <dt className="text-muted">E-post</dt>
          <dd>{profile?.email || user.email}</dd>
        </div>
        <div className="flex justify-between px-3 py-2">
          <dt className="text-muted">Rolle</dt>
          <dd>{profile?.role ?? "member"}</dd>
        </div>
      </dl>

      <form onSubmit={submit} className="border border-border rounded bg-panel p-4 space-y-3">
        <div className="text-sm font-medium">Bytt passord</div>
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Nytt passord (min. 8 tegn)"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          className="w-full bg-panel-2 border border-border rounded px-2 py-1.5 text-sm"
        />
        <input
          type="password"
          autoComplete="new-password"
          placeholder="Gjenta nytt passord"
          value={pw2}
          onChange={(e) => setPw2(e.target.value)}
          className="w-full bg-panel-2 border border-border rounded px-2 py-1.5 text-sm"
        />
        {err && (
          <p className="text-sm" style={{ color: "var(--danger-fg)" }}>
            {err}
          </p>
        )}
        {ok && <p className="text-sm text-muted">Passord oppdatert.</p>}
        <button
          type="submit"
          disabled={busy}
          className="bg-accent text-black rounded px-3 py-1.5 text-sm font-semibold hover:brightness-110 disabled:opacity-60"
        >
          {busy ? "Lagrer …" : "Lagre passord"}
        </button>
      </form>

      <button
        onClick={() => signOut().then(() => router.replace("/"))}
        className="border border-border rounded px-3 py-1.5 text-sm hover:bg-panel-2"
      >
        Logg ut
      </button>
    </div>
  );
}
