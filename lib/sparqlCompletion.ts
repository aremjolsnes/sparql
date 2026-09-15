import { snippet } from "@codemirror/autocomplete";
import type { Completion, CompletionContext, CompletionResult } from "@codemirror/autocomplete";
import { FIXED_PREFIXES } from "@/lib/prefixes";
import type { OntologyTerm } from "@/lib/ontologyTerms";
import { requestAiSnippet } from "@/lib/aiAssist";

const U = FIXED_PREFIXES.u;
const localName = (uri: string) => (uri.startsWith(U) ? uri.slice(U.length) : uri);

/** Nullpunkt-datoer for koblinger der bNoden finnes, men mangler gyldig-fra/-til (Are, 2026-09-11). */
const LK06_EPOCH = "2006-08-01";
const LK20_EPOCH = "2020-08-01";
const EVIGHET = "9999-12-31";

/**
 * Sentinel for `#+ semester++:` (Are, 2026-09-15) – brukes når selve
 * semester-variabelen er ubundet (typisk fordi trippelen som binder den er
 * skrevet OPTIONAL av brukeren), i stedet for idé 2s reform-spesifikke
 * LK06/LK20-nullpunkt: semester-par gjelder flere typer (programområde/
 * utdanningsprogram/fagkode), ikke bare læreplaner, så en absolutt
 * "tidligst mulig"-dato er riktigere enn å gjette reform ut fra typen.
 * EVIGHET over gjenbrukes symmetrisk for manglende siste-semester.
 */
const TIDENES_MORGEN = "0001-01-01";

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

/**
 * Idé 4/5 (se Docs/ideer-ai-stotte.md): binder en semester-property-par
 * (`<prefiks>foerste-semester`/`<prefiks>siste-semester`, f.eks. det bare
 * paret for programområde/utdanningsprogram, eller "naar-gis-det-
 * undervisning-"/"naar-kan-man-ta-eksamen-"-paret for fagkode) til et faktisk
 * datospenn – ikke en hardkodet liste, men autodetektert fra OWL-kunnskapen
 * (idé 7) ved å finne property-par med `rdfs:range u:semester` der lokalnavnet
 * matcher mønsteret. Semester-ressursen selv (f.eks. d:semester_hoest_2020)
 * har ingen egne datoer i dataene – kun tittel/kortform/rekkefølge (bekreftet
 * empirisk mot Fuseki Beta 2026-09-11) – så kalenderhalvår er en bevisst
 * forenkling (Are bekreftet dette holder): vår = jan–jul, høst = aug–des,
 * samme presisjonsnivå som gyldighet-mønsteret (idé 2) bruker for filtrering.
 *
 * Spennet Are faktisk er ute etter (bekreftet 2026-09-11): start av
 * "første"-semesteret til slutt av "siste"-semesteret – IKKE bare start til
 * start. Derfor aug-01/jan-01 for fra-siden, men des-31/jul-31 for til-siden.
 */
type SemesterPair = {
  foerste: string;
  siste: string;
  domain: string[];
  suffix: string;
  labelNb: string | null;
};

function semesterProps(terms: OntologyTerm[]): OntologyTerm[] {
  const SEMESTER = U + "semester";
  return terms.filter((t) => t.kind !== "class" && t.range.includes(SEMESTER));
}

function findSemesterPairs(terms: OntologyTerm[]): SemesterPair[] {
  const byLocalName = new Map(semesterProps(terms).map((t) => [localName(t.uri), t]));
  const pairs: SemesterPair[] = [];
  for (const t of byLocalName.values()) {
    const ln = localName(t.uri);
    if (!ln.endsWith("foerste-semester")) continue;
    const prefix = ln.slice(0, -"foerste-semester".length); // "" eller f.eks. "naar-gis-det-undervisning-"
    const sisteTerm = byLocalName.get(`${prefix}siste-semester`);
    if (!sisteTerm) continue;
    const suffix = prefix.replace(/-$/, "").split("-").filter(Boolean).pop() ?? "";
    pairs.push({ foerste: ln, siste: `${prefix}siste-semester`, domain: t.domain, suffix, labelNb: t.labelNb });
  }
  return pairs;
}

function buildSemesterVarighetSnippetTemplate(pair: SemesterPair): string {
  const rawFra = pair.suffix ? `${pair.suffix}SemFra` : "semFra";
  const rawTil = pair.suffix ? `${pair.suffix}SemTil` : "semTil";
  const dateFra = pair.suffix ? `${pair.suffix}SemesterFra` : "semesterFra";
  const dateTil = pair.suffix ? `${pair.suffix}SemesterTil` : "semesterTil";
  return [
    // Ingen subjekt her med vilje – "u:" som ble skrevet var allerede i property-posisjon
    // (fortsetter forrige ";"), samme mønster som gyldighet-mønsteret i idé 2.
    `u:${pair.foerste} ?${rawFra} ;`,
    `   u:${pair.siste} ?${rawTil} .`,
    `BIND (xsd:date(CONCAT(STRAFTER(STRAFTER(str(?${rawFra}), "semester_"), "_"), ` +
      `IF(CONTAINS(str(?${rawFra}), "hoest"), "-08-01", "-01-01"))) AS ?${dateFra})`,
    `BIND (xsd:date(CONCAT(STRAFTER(STRAFTER(str(?${rawTil}), "semester_"), "_"), ` +
      `IF(CONTAINS(str(?${rawTil}), "hoest"), "-12-31", "-07-31"))) AS ?${dateTil})`,
    `FILTER (?${dateFra} <= "\${dato}"^^xsd:date && ?${dateTil} >= "\${dato}"^^xsd:date)\${}`,
  ].join("\n");
}

/**
 * Utvidelse av idé 4/5 (Are, 2026-09-15): samme regelbaserte semester→dato-
 * utregning, men for én *allerede bundet* variabel i stedet for et fersk
 * innsatt property-par. Trigges via `#+ semester: ?variabel` (idé 3s
 * `#+`-mekanisme, men rent regelbasert – ingen LLM-kall, i motsetning til
 * regex:/filter: – siden hvilken property som bandt variabelen kan slås opp
 * tekstlig i spørringen som allerede står skrevet, akkurat som gyldighet-
 * mønsterets refVar-gjenkjenning i idé 2).
 *
 * "Første"/"siste" i property-lokalnavnet avgjør start vs. slutt av
 * semesteret (se buildSemesterVarighetSnippetTemplate over for samme
 * dato-logikk) – ukjent hvilken side betyr at det ikke er en kjent
 * semester-property i det hele tatt.
 *
 * `#+ semester++:` (Are, 2026-09-15) er samme BIND, men med `withFallback`:
 * hvis variabelen selv er ubundet (typisk en bevisst OPTIONAL-trippel som
 * ikke matcher for raden – snippeten rører ikke ved selve trippelen, det er
 * opp til brukeren), COALESCE'es resultatet til TIDENES_MORGEN (manglende
 * "første") eller EVIGHET (manglende "siste") i stedet for å la ?outVar stå
 * ubundet – samme COALESCE-mønster som idé 2 bruker for gyldig-fra/-til.
 */
function buildSemesterDatoBind(variable: string, outVar: string, isEnd: boolean, withFallback: boolean): string {
  const hoestSuffix = isEnd ? "-12-31" : "-08-01";
  const vaarSuffix = isEnd ? "-07-31" : "-01-01";
  const expr =
    `xsd:date(CONCAT(STRAFTER(STRAFTER(str(?${variable}), "semester_"), "_"), ` +
    `IF(CONTAINS(str(?${variable}), "hoest"), "${hoestSuffix}", "${vaarSuffix}")))`;
  if (!withFallback) return `BIND (${expr} AS ?${outVar})`;
  const sentinel = isEnd ? EVIGHET : TIDENES_MORGEN;
  return `BIND (COALESCE(${expr}, "${sentinel}"^^xsd:date) AS ?${outVar})`;
}

/** Henter "?fS" eller "fS" ut av en `#+ semester: …`-beskrivelse (evt. med mer tekst rundt, f.eks. "?fS til dato"). */
function extractSemesterVariable(description: string): string | null {
  const withMarker = /\?(\w+)/.exec(description);
  if (withMarker) return withMarker[1];
  const bare = /^(\w+)$/.exec(description.trim());
  return bare ? bare[1] : null;
}

function errorOption(message: string): Completion {
  return { label: message, type: "keyword", apply: () => {} };
}

/**
 * Bygger completion-forslaget for `#+ semester: <variabel>`: finner hvilken
 * kjent semester-property som sist bandt variabelen tidligere i spørringen
 * (samme "siste binding vinner"-prinsipp som lastObjectVariable), og setter
 * inn riktig BIND. Ingen match (ukjent variabel, eller bundet av noe som
 * ikke er en kjent første/siste-semester-property) gir et feilforslag i
 * stedet for å gjette – samme "ingen fallback"-prinsipp som resten av idé 3.
 */
function buildSemesterDatoOption(
  description: string,
  precedingText: string,
  terms: OntologyTerm[],
  withFallback: boolean,
): Completion {
  const variable = extractSemesterVariable(description);
  if (!variable) {
    return errorOption(`Fant ingen variabel i "${description}" (forventet f.eks. "?fS").`);
  }

  const knownLocalNames = new Set(semesterProps(terms).map((t) => localName(t.uri)));
  const bindingRe = new RegExp(`u:([\\w-]+)\\s+\\?${variable}\\b`, "g");
  const matches = [...precedingText.matchAll(bindingRe)].filter((m) => knownLocalNames.has(m[1]));
  const lastMatch = matches[matches.length - 1];
  if (!lastMatch) {
    return errorOption(`Fant ingen kjent semester-property som binder ?${variable} tidligere i spørringen.`);
  }

  const propLocalName = lastMatch[1];
  const isEnd = propLocalName.endsWith("siste-semester");
  const outVar = `${variable}Dato`;
  const bind = buildSemesterDatoBind(variable, outVar, isEnd, withFallback);
  const fallbackNote = withFallback
    ? ` Ubundet ?${variable} (f.eks. en OPTIONAL-trippel som ikke matcher) gir ${isEnd ? `EVIGHET (${EVIGHET})` : `TIDENES_MORGEN (${TIDENES_MORGEN})`} i stedet for ubundet ?${outVar}.`
    : "";

  return {
    label: `semester${withFallback ? "++" : ""} → dato: ?${outVar}`,
    type: "keyword",
    detail: `fra u:${propLocalName}`,
    info: `Binder ?${outVar} til datoen for ${isEnd ? "slutten" : "starten"} av semesteret i ?${variable} (vår = jan–jul, høst = aug–des – kalenderhalvår, se idé 4).${fallbackNote}`,
    apply: (view, _completion, from, to) => {
      view.dispatch({ changes: { from, to, insert: bind } });
    },
  };
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
    let semesterPairs: SemesterPair[] = [];
    let block = "";

    if (!typePosition) {
      block = currentBlock(context.state.sliceDoc(0, context.pos));
      const knownTypes = declaredTypeUris(block);
      if (knownTypes.length > 0) {
        candidates = candidates.filter(
          (t) => t.domain.length === 0 || t.domain.some((d) => knownTypes.includes(d)),
        );
        semesterPairs = findSemesterPairs(terms).filter((p) =>
          p.domain.some((d) => knownTypes.includes(d)),
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

    for (const pair of semesterPairs) {
      options.push({
        label: pair.suffix ? `semester-varighet (${pair.suffix})` : "semester-varighet",
        type: "keyword",
        detail: "sett inn semester→dato-spenn",
        info:
          `Basert på u:${pair.foerste}/u:${pair.siste}` +
          (pair.labelNb ? ` (${pair.labelNb})` : "") +
          '. Vår = jan–jul, høst = aug–des (kalenderhalvår, semester-ressursen selv har ingen egne datoer). Spennet går fra start av "første"-semesteret til slutt av "siste"-semesteret.',
        boost: 2,
        apply: (view, completion, _from, to) => {
          snippet(buildSemesterVarighetSnippetTemplate(pair))(view, completion, match.from, to);
        },
      });
    }

    if (options.length === 0) return null;

    return { from: match.from + 2, options, validFor: /^[\w-]*$/ };
  };
}

const AI_ASSIST_LABEL: Record<"regex" | "filter", string> = {
  regex: "AI: generer regex fra beskrivelsen",
  filter: "AI: generer FILTER fra beskrivelsen",
};

const DESCRIBE_LABEL = "AI: beskriv spørringen";

/**
 * Idé 3 (se Docs/ideer-ai-stotte.md): `#+ regex: <beskrivelse>` eller
 * `#+ filter: <beskrivelse>` på en kommentarlinje sender beskrivelsen til et
 * LLM-kall (/api/ai-assist) og setter resultatet inn i stedet for linja.
 * `#` er allerede SPARQL-kommentartegn, så linja gjør ingenting før den
 * fremkalles. Kun manuell fremkalling (`context.explicit`, dvs. Ctrl+Space) –
 * aldri automatisk mens brukeren fortsatt skriver beskrivelsen. Ukjent/
 * manglende tema gir bevisst ingen completion (se diskusjon i idé 3).
 *
 * Idé 10: `#+?` alene på linja går motsatt vei – hele spørringen sendes til
 * samme API-rute (`describe`-tema) og svaret (en fritekst-beskrivelse,
 * ferdig formatert som `#`-linjer av API-et) erstatter `#+?`-linja. Ingen
 * `description` å parse ut her (i motsetning til regex/filter over), derfor
 * egen gren med eget regex-mønster.
 *
 * Utvidelse (Are, 2026-09-15): `#+ semester: <variabel>` er et tredje tema på
 * samme `#+`-mekanisme, men rent regelbasert (ingen LLM-kall) – se
 * buildSemesterDatoOption i idé 4/5-delen over. Trenger derfor OWL-
 * kunnskapen (`getTerms`, samme kilde som idé 1/4s regelbaserte fullføring)
 * for å kjenne igjen semester-properties.
 *
 * `#+ semester++: <variabel>` (Are, 2026-09-15) er samme tema, men med
 * COALESCE-fallback: dekker tilfellet der variabelen selv kan være ubundet
 * (f.eks. en bevisst OPTIONAL-trippel), og gir TIDENES_MORGEN/EVIGHET i
 * stedet for et ubundet resultat – snippeten rører ikke ved selve trippelen,
 * kun BIND-en.
 */
export function aiAssistCompletionSource(getTerms: () => OntologyTerm[]) {
  return async (context: CompletionContext): Promise<CompletionResult | null> => {
    if (!context.explicit) return null;

    const describeMatch = context.matchBefore(/#\+\?\s*$/);
    if (describeMatch) {
      // Hele spørringen, ikke bare teksten foran `#+?` – i motsetning til regex/filter-grenen
      // under står denne triggerlinja typisk øverst, så "det som kommer før" er ikke nyttig kontekst.
      const fullQuery = context.state.doc.toString();

      let option: Completion;
      try {
        const description = await requestAiSnippet("describe", "", fullQuery);
        option = {
          label: `${DESCRIBE_LABEL}: ${description.replace(/\s+/g, " ").slice(0, 60)}`,
          type: "keyword",
          apply: (view, _completion, from, to) => {
            view.dispatch({ changes: { from, to, insert: description } });
          },
        };
      } catch (e) {
        option = {
          label: `AI-kall feilet: ${(e as Error).message}`,
          type: "keyword",
          apply: () => {},
        };
      }

      return { from: describeMatch.from, to: describeMatch.to, options: [option], filter: false };
    }

    const match = context.matchBefore(/#\+\s*(regex|filter|semester\+\+|semester)\s*:\s*.+/i);
    if (!match) return null;

    const parsed = /^#\+\s*(regex|filter|semester\+\+|semester)\s*:\s*(.+)$/i.exec(match.text);
    if (!parsed) return null;
    const topic = parsed[1].toLowerCase() as "regex" | "filter" | "semester" | "semester++";
    const description = parsed[2].trim();
    if (!description) return null;

    // Hele spørringsteksten før `#+`-linja, ikke bare currentBlock() (som kutter ved siste
    // "." – for narrowt for et LLM-kall som skal gjenkjenne variabler fra tidligere tripler,
    // i motsetning til idé 1/2s eksakte regelbaserte oppslag som trenger den narrowe scopen).
    const precedingQuery = context.state.sliceDoc(0, match.from);

    if (topic === "semester" || topic === "semester++") {
      const option = buildSemesterDatoOption(description, precedingQuery, getTerms(), topic === "semester++");
      return { from: match.from, to: match.to, options: [option], filter: false };
    }

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
