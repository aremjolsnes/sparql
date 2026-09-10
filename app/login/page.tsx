"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const { enabled, user, loading, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) router.replace("/");
  }, [loading, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setErr(error);
    else router.replace("/");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-sm border border-border rounded-lg bg-panel p-6">
        <h1 className="text-lg font-semibold mb-1">Logg inn</h1>
        <p className="text-sm text-muted mb-5">
          Innlogging er valgfritt – det lar deg lagre spørringer og beholde fanene mellom
          økter.
        </p>

        {!enabled ? (
          <p className="text-sm" style={{ color: "var(--danger-fg)" }}>
            Innlogging er ikke satt opp i dette miljøet.
          </p>
        ) : (
          <form onSubmit={submit} className="space-y-3">
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm text-muted">
                E-post
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-panel-2 border border-border rounded px-2 py-1.5 text-sm"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm text-muted">
                Passord
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-panel-2 border border-border rounded px-2 py-1.5 text-sm"
              />
            </div>
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
              {busy ? "Logger inn …" : "Logg inn"}
            </button>
            <a href="/" className="block text-center text-sm text-link hover:underline">
              Tilbake til workbench
            </a>
          </form>
        )}
      </div>
    </div>
  );
}
