import { NextRequest, NextResponse } from "next/server";
import { FIXED_PREFIXES } from "@/lib/prefixes";

export const runtime = "nodejs";

const TOPICS = ["regex", "filter"] as const;
type Topic = (typeof TOPICS)[number];

// Haiku er billig/rask nok for å oversette en kort beskrivelse til et SPARQL-fragment.
const MODEL = "claude-haiku-4-5-20251001";
const MAX_DESCRIPTION_LEN = 500;
const MAX_CONTEXT_LEN = 2000;

const PREFIX_LINES = Object.entries(FIXED_PREFIXES)
  .map(([p, uri]) => `PREFIX ${p}: <${uri}>`)
  .join("\n");

const TOPIC_INSTRUCTIONS: Record<Topic, string> = {
  regex:
    'Som standard: svar med KUN et regex(...)-uttrykk (SPARQL-funksjonen), f.eks. regex(str(?kode), "^NOR") ' +
    "– ikke pakk det inn i FILTER(...) eller BIND(...) selv. MEN: hvis beskrivelsen eksplisitt ber om noe " +
    "annet – f.eks. å binde resultatet til en variabel, eller pakke det som et filter – følg det i stedet. " +
    "Ikke skriv noe annet enn selve SPARQL-fragmentet uansett.",
  filter:
    "Svar med KUN en komplett FILTER(...)-linje. Hvis den trenger støtte fra BIND/OPTIONAL " +
    "rundt seg (som i eksisterende mønstre i konteksten under), kan du inkludere disse linjene også.",
};

/**
 * Idé 3 (se Docs/ideer-ai-stotte.md): tar en fritekst-beskrivelse fra en
 * `#+ regex: …`/`#+ filter: …`-kommentarlinje og ber Claude generere et
 * innsettbart SPARQL-fragment. Ingen auth/rate-limiting – appen har p.t.
 * maks 3-4 kjente brukere, ikke en reell misbruksrisiko.
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "AI-hjelp er ikke konfigurert (mangler ANTHROPIC_API_KEY)." },
      { status: 501 },
    );
  }

  let body: { topic?: string; description?: string; context?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Forventet JSON-body." }, { status: 400 });
  }

  const topic = body.topic as Topic;
  if (!TOPICS.includes(topic)) {
    return NextResponse.json({ error: "Ukjent tema (forventet regex eller filter)." }, { status: 400 });
  }

  const description = (body.description ?? "").trim().slice(0, MAX_DESCRIPTION_LEN);
  if (!description) {
    return NextResponse.json({ error: "Mangler beskrivelse." }, { status: 400 });
  }
  // Behold slutten av teksten (nærmest #+-linja) hvis den er for lang – det er der
  // variablene som faktisk er relevante for beskrivelsen typisk står.
  const rawContext = (body.context ?? "").trim();
  const context = rawContext.slice(Math.max(0, rawContext.length - MAX_CONTEXT_LEN));

  const userPrompt = [
    TOPIC_INSTRUCTIONS[topic],
    "",
    context
      ? `Trippel-blokk skrevet så langt (for gjenbruk av variabelnavn):\n${context}`
      : "(ingen forutgående trippel-blokk å vise til)",
    "",
    `Beskrivelse fra bruker: ${description}`,
  ].join("\n");

  const SYSTEM_PROMPT = `Du hjelper med å skrive SPARQL mot Grep, Utdanningsdirektoratets kodeverk-API.
Faste prefikser tilgjengelig i spørringen:
${PREFIX_LINES}

Brukeren har skrevet en fritekst-beskrivelse av hva de vil filtrere/matche på. Du skal IKKE
forklare noe, IKKE bruke Markdown-kodeblokker eller \`-tegn, og IKKE gjenta konteksten – svar
med RÅ SPARQL-tekst som kan settes rett inn i editoren i stedet for beskrivelsen, ingenting annet.

Viktig presisjon: det literale ordet UNDEF finnes KUN som gyldig syntaks inni en VALUES-blokk.
Bruk det ALDRI andre steder (f.eks. som gren i IF(...) eller COALESCE(...)) – det gir parse
error, selv om det virker som et naturlig "ingen verdi"-uttrykk. Trenger du en betinget ubundet
variabel (BIND(IF(vilkår, ?verdi-hvis-sant, <et-fall-tilbake>) AS ?resultat)), er riktig
SPARQL-idiom å referere til en variabel som IKKE er bundet noe annet sted i spørringen – det gir
en evalueringsfeil som lar ?resultat forbli ubundet for den raden uten at hele spørringen feiler.
Eksempel: BIND(IF(regex(str(?k), "^NOR"), ?k, ?ub) AS ?kode) – ikke BIND(IF(..., ?k, UNDEF) AS
?kode). Hvis brukerens beskrivelse egentlig handler om å ekskludere rader (ikke om en betinget
binding), er et vanlig FILTER ofte enklere og riktigere enn IF/BIND-trikset over.`;

  let upstream: Response;
  try {
    upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: `Fikk ikke kontakt med AI-tjenesten: ${(e as Error).message}` },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => "");
    return NextResponse.json(
      { error: text.slice(0, 2000) || `AI-tjenesten svarte med HTTP ${upstream.status}.` },
      { status: 502 },
    );
  }

  const data = await upstream.json();
  const snippet = (data?.content?.[0]?.text ?? "").trim();
  if (!snippet) {
    return NextResponse.json({ error: "AI-svaret var tomt." }, { status: 502 });
  }

  return NextResponse.json({ snippet });
}
