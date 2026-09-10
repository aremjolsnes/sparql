"use client";

import { useAuth } from "@/components/AuthProvider";

export default function AuthBar() {
  const { enabled, loading, user, profile, signOut } = useAuth();

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

  return (
    <div className="flex items-center gap-3 text-sm">
      {profile?.role === "admin" && (
        <a href="/admin" className="text-link hover:underline">
          Admin
        </a>
      )}
      <a href="/profil" className="text-link hover:underline" title="Profil og passord">
        {name}
      </a>
      <button
        onClick={() => signOut()}
        className="border border-border rounded px-2 py-1 hover:bg-panel-2"
      >
        Logg ut
      </button>
    </div>
  );
}
