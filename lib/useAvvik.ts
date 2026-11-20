"use client";

import { useEffect, useState } from "react";

export type AvvikIssue = {
  number: number;
  title: string;
  url: string;
  body: string;
  created_at: string;
  updated_at: string;
  comments: number;
  assignees: string[];
};

export type AvvikSvar = { url: string; issues: AvvikIssue[] };

/**
 * Åpne issues i sandkasse-repoet («Avvik i Grep-dataene» fra den nattlige innlastingen), for
 * admin-brukere. Brukes både av bobla ved «Admin» i topplinja og av panelet på /admin.
 * `issues` er null til svaret kommer. Uten token hentes ingenting.
 */
export function useAvvik(accessToken: string | null | undefined, aktiv = true) {
  const [svar, setSvar] = useState<AvvikSvar | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  useEffect(() => {
    if (!aktiv || !accessToken) return;
    let avbrutt = false;
    fetch("/api/admin/avvik", { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(async (res) => {
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
        return json as AvvikSvar;
      })
      .then(
        (json) => {
          if (!avbrutt) setSvar(json);
        },
        (e) => {
          if (!avbrutt) setFeil((e as Error).message);
        },
      );
    return () => {
      avbrutt = true;
    };
  }, [accessToken, aktiv]);

  return { issues: svar?.issues ?? null, url: svar?.url ?? "", feil };
}
