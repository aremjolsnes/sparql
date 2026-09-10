"use client";

import { useAuth } from "@/components/AuthProvider";

export default function AuthBar() {
  const { enabled, loading, user, profile, signOut, changePassword } = useAuth();

  if (!enabled || loading) return null;

  if (!user) {
    return (
      <a
        href="/login"
        className="border border-border rounded px-3 py-1 text-sm hover:bg-panel-2"
      >
        Logg inn
      </a>
    );
  }

  const name = profile?.email || user.email || "bruker";

  async function onChangePassword() {
    const pw = window.prompt("Nytt passord (min. 8 tegn):");
    if (!pw) return;
    if (pw.length < 8) {
      alert("Minst 8 tegn.");
      return;
    }
    const { error } = await changePassword(pw);
    alert(error ? `Feil: ${error}` : "Passord oppdatert.");
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-muted">{name}</span>
      {profile?.role === "admin" && (
        <a href="/admin" className="text-link hover:underline">
          Admin
        </a>
      )}
      <button onClick={onChangePassword} className="text-link hover:underline">
        Bytt passord
      </button>
      <button
        onClick={() => signOut()}
        className="border border-border rounded px-2 py-1 hover:bg-panel-2"
      >
        Logg ut
      </button>
    </div>
  );
}
