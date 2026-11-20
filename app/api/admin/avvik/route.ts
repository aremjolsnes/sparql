import { NextRequest } from "next/server";
import { requireAdmin, adminConfigured } from "@/lib/supabase/admin";
import type { AvvikIssue } from "@/lib/useAvvik";

export const runtime = "nodejs";

/**
 * Åpne issues i sandkasse-repoet, til admin-siden. Den nattlige innlastingen i grep-jena-fuseki
 * skriver avvik i dataene til issuen «Avvik i Grep-dataene» (scripts/rapporter-avvik.sh), og
 * brødteksten holdes lik det siste funnet. Repoet er offentlig, så GitHub-API-et svarer uten token;
 * GITHUB_TOKEN gir bare høyere grense. Svaret bufres i fem minutter.
 */
const REPO = process.env.GITHUB_REPO || "aremjolsnes/grep-jena-fuseki";

type GitHubIssue = {
  number: number;
  title: string;
  html_url: string;
  body: string | null;
  created_at: string;
  updated_at: string;
  comments: number;
  assignees?: { login: string }[];
  pull_request?: unknown;
};

export async function GET(req: NextRequest) {
  if (!adminConfigured()) {
    return Response.json({ error: "Supabase er ikke konfigurert på serveren." }, { status: 503 });
  }
  const caller = await requireAdmin(req);
  if (caller instanceof Response) return caller;

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "sparql-workbench",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${REPO}/issues?state=open&per_page=50`, {
      headers,
      next: { revalidate: 300 },
    });
  } catch (e) {
    return Response.json(
      { error: `Fikk ikke kontakt med GitHub: ${(e as Error).message}` },
      { status: 502 },
    );
  }
  if (!res.ok) {
    return Response.json({ error: `GitHub svarte ${res.status} for ${REPO}.` }, { status: 502 });
  }

  const data = (await res.json()) as GitHubIssue[];
  const issues: AvvikIssue[] = data
    .filter((i) => !i.pull_request) // API-et for issues gir også pull requests
    .map((i) => ({
      number: i.number,
      title: i.title,
      url: i.html_url,
      body: i.body ?? "",
      created_at: i.created_at,
      updated_at: i.updated_at,
      comments: i.comments,
      assignees: (i.assignees ?? []).map((a) => a.login),
    }));

  return Response.json({ repo: REPO, url: `https://github.com/${REPO}/issues`, issues });
}
