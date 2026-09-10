"use client";

import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

export default function FirstPasswordModal() {
  const { enabled, user, profile, changePassword, clearMustChangePassword, signOut } =
    useAuth();
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!enabled || !user || !profile?.mustChangePassword || dismissed) return null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (pw.length < 8) return setErr("Minst 8 tegn.");
    if (pw !== pw2) return setErr("Passordene er ikke like.");
    setBusy(true);
    const { error } = await changePassword(pw);
    if (error) {
      setBusy(false);
      return setErr(error);
    }
    await clearMustChangePassword();
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-6">
      <div className="w-full max-w-sm border border-border rounded-lg bg-panel p-6">
        <h2 className="text-base font-semibold mb-1">Sett ditt eget passord</h2>
        <p className="text-sm text-muted mb-4">
          Du logget inn med et midlertidig passord. Velg et eget passord for å fortsette.
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input
            type="password"
            autoComplete="new-password"
            placeholder="Nytt passord (min. 8 tegn)"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="w-full bg-panel-2 border border-border rounded px-2 py-1.5 text-sm"
            autoFocus
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
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-accent text-black rounded px-3 py-1.5 text-sm font-semibold hover:brightness-110 disabled:opacity-60"
          >
            {busy ? "Lagrer …" : "Lagre passord"}
          </button>
          <div className="flex justify-between text-xs text-muted pt-1">
            <button type="button" onClick={() => setDismissed(true)} className="hover:underline">
              Gjør det senere
            </button>
            <button type="button" onClick={() => signOut()} className="hover:underline">
              Logg ut
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
