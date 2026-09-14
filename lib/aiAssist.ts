"use client";

export type AiAssistTopic = "regex" | "filter" | "describe";

/**
 * Idé 3/10 (se Docs/ideer-ai-stotte.md): idé 3 oversetter en fritekst-beskrivelse
 * (`#+ regex: …` / `#+ filter: …`) til et SPARQL-fragment. Idé 10 går motsatt
 * vei (`#+?`): oversetter en eksisterende spørring til en fritekst-beskrivelse,
 * satt inn som kommentar – da er `description` tom og `context` er hele
 * spørringen, ikke bare teksten foran kommentarlinja. Begge går via samme
 * LLM-kall mot /api/ai-assist. Fremkalles kun manuelt (Ctrl+Space), se
 * sparqlCompletion.ts.
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
