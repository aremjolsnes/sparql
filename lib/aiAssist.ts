"use client";

export type AiAssistTopic = "regex" | "filter";

/**
 * Idé 3 (se Docs/ideer-ai-stotte.md): oversetter en fritekst-beskrivelse
 * (`#+ regex: …` / `#+ filter: …`) til et SPARQL-fragment via et LLM-kall mot
 * /api/ai-assist. Fremkalles kun manuelt (Ctrl+Space), se sparqlCompletion.ts.
 */
export async function requestAiSnippet(
  topic: AiAssistTopic,
  description: string,
  context: string,
): Promise<string> {
  const res = await fetch("/api/ai-assist", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ topic, description, context }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok || !body?.snippet) {
    throw new Error(body?.error ?? `AI-kallet feilet (HTTP ${res.status}).`);
  }
  return body.snippet as string;
}
