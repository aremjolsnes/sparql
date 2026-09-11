import { snippet } from "@codemirror/autocomplete";
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { FIXED_PREFIXES } from "@/lib/prefixes";
import type { OntologyTerm } from "@/lib/ontologyTerms";
import { requestAiSnippet, type AiAssistTopic } from "@/lib/aiAssist";

const U = FIXED_PREFIXES.u;
const localName = (uri: string) => (uri.startsWith(U) ? uri.slice(U.length) : uri);

/** Nullpunkt-datoer for koblinger der bNoden finnes, men mangler gyldig-fra/-til (Are, 2026-09-11). */
const LK06_EPOCH = "2006-08-01";
const LK20_EPOCH = "2020-08-01";
const EVIGHET = "9999-12-31";

/**
 * Idé 2 (se Docs/ideer-ai-stotte.md): mønster for koblinger som selv har en
 * gyldighetsperiode (ikke objektene i seg selv), jf. Grepwiki "Blanke noder
 * for gyldighetsinformasjon i referanseobjekter". Property-navnet på bNoden
 * er dynamisk generert per data-instans (f.eks. u:gyldighet-opplaeringsfag-
 * ADI2Z01) og kan derfor ikke slås opp i OWL-kunnskapen som idé 1 gjør –
 * mønsteret rundt det er derimot alltid det samme, uansett hvilken referanse
 * det gjelder.
 *
 * regex()-en matcher typisk mot koden til det refererte objektet, ikke en
 * bokstavelig streng – derfor bindes ?kode fra `<referanse> u:kode ?kode`
 * (samme mønster som i Grepwiki-eksempelet). `refVar` forhåndsutfyller
 * referanse-variabelen med den sist bundne `?var`-en i gjeldende blokk (f.eks.
 * "?of" fra "u:etter-fag ?of"), som tab-stopp – bommer den, kan brukeren bare
 * skrive over.
 *
 * u:gyldig-fra/-til er hver for seg gjort optional: en funnet bNode kan
 * mangle den ene datoen. Manglende gyldig-fra COALESCE'es til reformens
 * nullpunkt (LK06: 2006-08-01, LK20: 2020-08-01 – gjenkjent fra `a u:*_lk20`
 * i blokka, ellers LK06), manglende gyldig-til til en «evighets»-dato
 * (9999-12-31), så FILTER-et under kan sammenligne uten å håndtere ubundne
 * verdier separat. Dette dekker IKKE tilfellet der koblingen mangler helt
 * (ingen bNode i det hele tatt) – det krever å pakke hele mønsteret inn i en
 * egen OPTIONAL rundt subjektet, som denne snippeten ikke gjør automatisk.
 *
 * Dataene har gyldig-fra/-til som xsd:dateTime, ikke xsd:date. En
 * dateTime<=date-sammenligning feiler stille i SPARQL (typemismatch gir en
 * feil i uttrykket, som FILTER tolker som usann) – derfor caster vi den
 * rå verdien til xsd:date *inni* COALESCE (xsd:date(?raa)), slik at
 * resultatet alltid er konsekvent xsd:date, samme type som nullpunkt-/
 * evighetsverdiene og ${dato}. Bekreftet empirisk mot Fuseki Beta
 * (2026-09-11, se Docs/ideer-ai-stotte.md) – uten cast ga
 * dateTime<=date ingen verdi i det hele tatt (feil), ikke false.
 */
function buildGyldighetSnippetTemplate(refVar: string, lk20: boolean): string {
  const epoch = lk20 ? LK20_EPOCH : LK06_EPOCH;
  return [
    "?gyldighetskobling ?bnode .",
    "FILTER isBlank(?bnode)",
    "FILTER (regex(str(?gyldighetskobling), ?kode))",
    "OPTIONAL { ?bnode u:gyldig-fra ?gyldigFraRaa . }",
    "OPTIONAL { ?bnode u:gyldig-til ?gyldigTilRaa . }",
    `BIND (COALESCE(xsd:date(?gyldigFraRaa), "${epoch}"^^xsd:date) AS ?gyldigFra)`,
    `BIND (COALESCE(xsd:date(?gyldigTilRaa), "${EVIGHET}"^^xsd:date) AS ?gyldigTil)`,
    'FILTER (?gyldigFra <= "${dato}"^^xsd:date && ?gyldigTil >= "${dato}"^^xsd:date)',
    `\${${refVar}} u:kode ?kode .\${}`,
  ].join("\n");
}

/** Sist bundne "?variabel" som objekt for en u:-property i blokka (f.eks. "?of" i "u:etter-fag ?of"). */
function lastObjectVariable(block: string): string | null {
  const matches = [...block.matchAll(/u:[\w-]+\s+(\?\w+)/g)];
  return matches.length > 0 ? matches[matches.length - 1][1] : null;
}

/** Teksten fra starten av gjeldende trippel-blokk (etter siste "." eller "{") fram til cursor. */
function currentBlock(uptoCursor: string): string {
  const stop = Math.max(uptoCursor.lastIndexOf("."), uptoCursor.lastIndexOf("{"));
  return uptoCursor.slice(stop + 1);
}

/** Typer deklarert med "a u:X" (evt. "a u:X, u:Y, …") i gjeldende blokk. */
function declaredTypeUris(block: string): string[] {
  const m = block.match(/(?:^|[\s;])a\s+([^;.]+)/);
  if (!m) return [];
  return [...m[1].matchAll(/u:([\w-]+)/g)].map((mm) => U + mm[1]);
}

/** Er "u:"-tokenet vi fullfører selve typen i en "?s a u:…"-deklarasjon? */
function isTypePosition(beforeMatch: string): boolean {
  return /\ba(\s+u:[\w-]+\s*,\s*)*\s*$/.test(beforeMatch);
}

/**
 * Fullføring for `u:`-tokens (idé 1, se Docs/ideer-ai-stotte.md): rent
 * regelbasert oppslag i OWL-kunnskapen (idé 7) – ingen nettverkskall her,
 * `getTerms` leser fra en allerede hentet/cachet liste.
 *
 * - Rett etter "a " (rdf:type): foreslår klasser.
 * - Ellers: foreslår properties, innsnevret til dem hvis domain matcher en
 *   type som allerede er deklarert med "a u:…" for samme subjekt i blokka
 *   (properties uten domain vises alltid, siden de kan gjelde hva som helst).
 */
export function sparqlCompletionSource(getTerms: () => OntologyTerm[]) {
  return (context: CompletionContext): CompletionResult | null => {
    const match = context.matchBefore(/u:[\w-]*$/);
    if (!match) return null;

    const terms = getTerms();
    const before = context.state.sliceDoc(0, match.from);
    const typePosition = isTypePosition(before);

    let candidates = terms.filter((t) => (typePosition ? t.kind === "class" : t.kind !== "class"));

    if (!typePosition) {
      const block = currentBlock(context.state.sliceDoc(0, context.pos));
      const knownTypes = declaredTypeUris(block);
      if (knownTypes.length > 0) {
        candidates = candidates.filter(
          (t) => t.domain.length === 0 || t.domain.some((d) => knownTypes.includes(d)),
        );
      }
    }

    const options: Completion[] = candidates.map((t) => ({
      label: localName(t.uri),
      type: typePosition ? "class" : "property",
      detail: t.labelNb ?? t.labelEn ?? undefined,
      info: [t.labelEn, t.commentNb ?? t.commentEn].filter(Boolean).join(" — ") || undefined,
      boost: t.domain.length > 0 ? 1 : 0,
    }));

    if (!typePosition) {
      options.push({
        label: "gyldighet-mønster",
        type: "keyword",
        detail: "sett inn kobling-gyldighetssjekk (bNode)",
        info: "For koblinger som selv har en gyldighetsperiode, ikke objektene i seg selv – se Grepwiki: Blanke noder for gyldighetsinformasjon i referanseobjekter. Manglende gyldig-fra/-til på en funnet bNode fylles ut med reformens nullpunkt (LK06/LK20, gjenkjent fra typen) og en evighets-dato. OBS: bruk en eksplisitt kolonneliste i SELECT (ikke *) og utelat ?bnode – ellers kan flere blanke noder med samme innhold gi tilsynelatende like rader som bare skiller seg på bnode-id. Vurder også SELECT DISTINCT.",
        boost: 2,
        apply: (view, completion, _from, to) => {
          const block = currentBlock(view.state.sliceDoc(0, match.from));
          const refVar = lastObjectVariable(block) ?? "?ref";
          const lk20 = declaredTypeUris(block).some((uri) => uri.endsWith("_lk20"));
          snippet(buildGyldighetSnippetTemplate(refVar, lk20))(view, completion, match.from, to);
        },
      });
    }

    if (options.length === 0) return null;

    return { from: match.from + 2, options, validFor: /^[\w-]*$/ };
  };
}

const AI_ASSIST_LABEL: Record<AiAssistTopic, string> = {
  regex: "AI: generer regex fra beskrivelsen",
  filter: "AI: generer FILTER fra beskrivelsen",
};

/**
 * Idé 3 (se Docs/ideer-ai-stotte.md): `#+ regex: <beskrivelse>` eller
 * `#+ filter: <beskrivelse>` på en kommentarlinje sender beskrivelsen til et
 * LLM-kall (/api/ai-assist) og setter resultatet inn i stedet for linja.
 * `#` er allerede SPARQL-kommentartegn, så linja gjør ingenting før den
 * fremkalles. Kun manuell fremkalling (`context.explicit`, dvs. Ctrl+Space) –
 * aldri automatisk mens brukeren fortsatt skriver beskrivelsen. Ukjent/
 * manglende tema gir bevisst ingen completion (se diskusjon i idé 3).
 */
export function aiAssistCompletionSource() {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    if (!context.explicit) return null;

    const match = context.matchBefore(/#\+\s*(regex|filter)\s*:\s*.+/i);
    if (!match) return null;

    const parsed = /^#\+\s*(regex|filter)\s*:\s*(.+)$/i.exec(match.text);
    if (!parsed) return null;
    const topic = parsed[1].toLowerCase() as AiAssistTopic;
    const description = parsed[2].trim();
    if (!description) return null;

    // Hele spørringsteksten før `#+`-linja, ikke bare currentBlock() (som kutter ved siste
    // "." – for narrowt for et LLM-kall som skal gjenkjenne variabler fra tidligere tripler,
    // i motsetning til idé 1/2s eksakte regelbaserte oppslag som trenger den narrowe scopen).
    const precedingQuery = context.state.sliceDoc(0, match.from);

    let option: Completion;
    try {
      const generated = await requestAiSnippet(topic, description, precedingQuery);
      option = {
        label: `${AI_ASSIST_LABEL[topic]}: ${generated.slice(0, 60)}`,
        type: "keyword",
        apply: (view, _completion, from, to) => {
          view.dispatch({ changes: { from, to, insert: generated } });
        },
      };
    } catch (e) {
      option = {
        label: `AI-kall feilet: ${(e as Error).message}`,
        type: "keyword",
        apply: () => {},
      };
    }

    return { from: match.from, to: match.to, options: [option], filter: false };
  };
}
