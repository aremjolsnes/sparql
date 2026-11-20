"use client";

import { useAuth } from "@/components/AuthProvider";
import Boble from "@/components/Boble";
import { useAvvik } from "@/lib/useAvvik";

export default function AuthBar() {
  const { enabled, loading, user, profile, accessToken, signOut } = useAuth();
  // Åpne avvik i Grep-dataene (issues i sandkasse-repoet), bare for admin. Svaret bufres på serveren.
  const erAdmin = profile?.role === "admin";
  const { issues } = useAvvik(accessToken, erAdmin);
  const antallAvvik = issues?.length ?? 0;

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
      {erAdmin && (
        <a href="/admin" className="text-link hover:underline">
          Admin
          {antallAvvik > 0 && (
            <Boble
              antall={antallAvvik}
              title={antallAvvik === 1 ? "1 åpen sak om avvik i Grep-dataene" : `${antallAvvik} åpne saker om avvik i Grep-dataene`}
            />
          )}
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
