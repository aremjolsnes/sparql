# Idéer – AI-/verktøystøtte i editoren

Registrert 2026-09-11. Dette er en idé-logg, ikke en spec – hver idé diskuteres og
konkretiseres før den evt. flyttes inn i [spesifikasjon.md](spesifikasjon.md) og bygges.

Status-koder: 🟡 til diskusjon · 🟢 spec klar, ikke bygget · 🔵 bygget

## 1. 🔵 Forslag til fullføring (autocomplete)

Kontekstsensitiv autocomplete i editoren:
- `d:kode ` → foreslå tilgjengelige `u:`-properties for den typen.
- `?s a u:<type> ; u:<property>` → valghjelp for gyldige typer / properties.

**Avgrenset til v1 (2026-09-11):** kun `u:`-fullføring (klasser/properties fra
idé 7), ikke `d:`-instansdata (det ville krevd live spørring mot endepunktet –
egen idé senere om ønskelig).

**Bygget:** `@codemirror/autocomplete` (allerede transitiv avhengighet via
`codemirror`-pakken, lagt til eksplisitt) koblet inn via
`sparqlLanguage.data.of({ autocomplete: … })` i
[components/SparqlEditor.tsx](../components/SparqlEditor.tsx). Trigger: CodeMirrors
innebygde – automatisk dropdown mens man skriver, pluss Ctrl+Space manuelt.
Logikk i [lib/sparqlCompletion.ts](../lib/sparqlCompletion.ts) (rent
tekst-/regelbasert, ingen nettverkskall i selve fullføringen):
- Rett etter `a ` (evt. `a u:X, `): foreslår klasser.
- Ellers: foreslår properties, innsnevret til dem med domain som matcher en
  type deklarert med `a u:X` (evt. flere via komma) tidligere i samme
  trippel-blokk. Properties uten domain vises alltid.

Data hentes via [lib/ontologyTerms.ts](../lib/ontologyTerms.ts) (Supabase,
åpen lesing, cachet i minnet for sesjonen).

**Verifisert:** typecheck + lint (ingen nye feil utover 8 pre-eksisterende på
main). Ekte nettleser-test var ikke mulig i dette miljøet (Chromium-binæren
nektes kjøreløyve av sandboksen – både via `chromium-cli` og en lokalt
installert Playwright-Chromium feilet med "spawn UNKNOWN"/"Permission
denied"). I stedet kjørt en integrasjonstest av selve fullførings-kilden
(`sparqlCompletionSource`) via `tsx`, med ekte `CompletionContext`/`EditorState`
fra CodeMirror og ekte data hentet live fra Supabase – dekket alle fire
scenarioene over pluss eksplisitte sanity-sjekk (alle 47 fagkode-properties
med i forslaget, ingen properties lekker inn i klasse-forslag). Testfilene
var midlertidige og er fjernet igjen; ikke visuelt bekreftet i en faktisk
nettleser.

## 2. 🔵 Gyldighet på koblinger, bNoder og filterhjelp

Ref. [Grepwiki: Blanke noder for gyldighetsinformasjon i referanseobjekter](https://github.com/Utdanningsdirektoratet/Grep_SPARQL/wiki/Blanke-noder-for-gyldighetsinformasjon-i-referanseobjekter).

Verktøystøtte for å skrive riktig SPARQL rundt gyldighet på koblinger og bNode-håndtering,
inkl. hjelp til å formulere aktuelle FILTER-uttrykk i denne sammenhengen.

**Bekreftet mot ekte data (2026-09-11):** spurte Fuseki Beta for properties som
peker til bNoder – mønsteret `u:gyldighet-<referanse>-<kode>` er i aktiv bruk
på tvers av mange ulike referanser (`opplaeringsfag`, `fagkode-referanser`,
`laereplan-referanse`, `tilhoerende-kompetansemaalsett`, `bygger-paa-
programomraade`, `benyttes-paa-aarstrinn`, …). Siden property-navnet er
dynamisk generert per data-instans, kan det ikke slås opp i OWL-kunnskapen
(idé 1/7) – men selve spørrings-*mønsteret* er alltid det samme.

**Valgt løsning:** ikke fullføring, men en innsettbar **snippet** (samme sted
som idé 1 – dukker opp som eget valg i `u:`-dropdownen i property-posisjon,
merket «gyldighet-mønster»), med tab-stopp for kode og dato. Datofilteret
(`gyldig-fra`/`gyldig-til` mot en gitt dato) er inkludert i snippeten, ikke
en separat idé 5-lignende ting.

**Bygget:** [lib/sparqlCompletion.ts](../lib/sparqlCompletion.ts) – bruker
CodeMirrors innebygde `snippet()`-hjelper (@codemirror/autocomplete), med en
egen `apply`-funksjon som fjerner det innskrevne `u:` og setter inn hele
mønsteret i stedet. Vises alltid i property-posisjon (uavhengig av
domain-innsnevring), ikke i type-posisjon (`a u:`).

**Verifisert:** samme begrensning som idé 1 – ingen ekte nettleser tilgjengelig
i miljøet. Kjørte i stedet en logikk-test (`tsx`, midlertidig, fjernet igjen)
som bekrefter: (1) mønsteret vises IKKE i type-posisjon, (2) det vises i
property-posisjon med riktig label/detail, (3) faktisk innsetting (simulert
med en minimal `{state, dispatch}`-editor, siden `snippet()` ikke krever en
ekte `EditorView`/DOM) gir korrekt SPARQL med riktig semikolon-fortsettelse.

**Justert etter Ares egen bruk (2026-09-11):** i praksis er koden i
regex()-en nesten alltid en variabel bundet fra det refererte objektet
(`?of u:kode ?kode`), ikke en bokstavelig streng – Ares eget eksempel
(`u:etter-fag ?of` → `?of u:kode ?kode` etterpå) viste dette. Endret derfor:
- `regex(str(?gyldighetskobling), ?kode)` bruker nå en bar variabel, ikke
  `"streng"`.
- Snippeten legger til en bindingslinje `<referanse> u:kode ?kode .` på
  slutten. `<referanse>` er et tab-stopp som **auto-utfylles** med den sist
  bundne `?variabel`-en i blokka (f.eks. "?of" fra `u:etter-fag ?of` – samme
  mekanisme som domain-gjenkjenningen i idé 1), med `?ref` som fallback når
  ingenting gjenkjennes.

Retestet med Ares eget eksempel (`tsx`, midlertidig): auto-utfylling til
"?of" bekreftet korrekt. Selv testet Are deretter i ekte nettleser og lastet
ned CSV med kolonnene `s,of,gyldighetskobling,bnode,gyldigFra,gyldigTil,kode`
– stemmer nøyaktig med snippet-variablene, altså fungerer mønsteret i
praksis.

**Driftserfaring fra Are:** CSV-en over hadde flere tilsynelatende
duplikat-rader (samme s/of/gyldighetskobling/gyldigFra/gyldigTil/kode, ulik
`?bnode`) – klassisk "diamant"-effekt av å ha `?bnode` med i SELECT når flere
blanke noder matcher samme mønster. Fiksen er å bruke en **eksplisitt
kolonneliste i SELECT (ikke `*`, som automatisk tar med `?bnode`)** og utelate
`?bnode`, gjerne kombinert med `SELECT DISTINCT`. Snippeten styrer ikke
SELECT-klausulen selv, så dette er lagt inn som en påminnelse i
`info`-teksten på fullførings-forslaget i stedet.

## 3. 🟡 Regex-hjelp

Regex er vanskelig å skrive riktig i FILTER/REGEX-uttrykk. Form for hjelp uklar ennå.

## 4. 🟡 Bind semester til dato

Vårsemester: åååå-01-01 til åååå-07-31. Høstsemester: åååå-08-01 til åååå-12-31
(rett datointervall må avklares – se merknad under).

Typiske verdier: `http://psi.udir.no/kl06/semester_hoest_2007`,
`http://psi.udir.no/kl06/semester_vaar_2021`.

Ønske: hjelp til å binde ting som `u:foerste-semester` (eller `u:*-foerste-semester`)
til faktiske datoer, slik at man kan filtrere med `<=`, `=`, `>=` mot datoverdier
i stedet for mot semester-URI-er direkte.

## 5. 🟡 Filterhjelp for semester

Egen filterhjelp knyttet til idé 4 – aktuelle FILTER-mønstre for semesterdatoer.

## 6. 🟡 Prefiks i tabell, hel URI i CSV

Vis forkortet form (`d:NOR01-07`) for URI-er i resultattabellen, men full URI ved
CSV-eksport. Avviker fra dagens spec (§ Resultathåndtering), som ikke sier noe om
forkortning i tabellvisning – må avklares mot cellevisnings-reglene der.

## 7. 🔵 Bygg inn OWL-kunnskap (labels/definisjoner)

Udirs OWL-filer (ikke i repoet) inneholder først og fremst `rdfs:label` og
definisjoner/beskrivelser ment for menneskelig forståelse av typer og egenskaper.
Ønske: gjøre denne kunnskapen tilgjengelig for AI-støtten i appen (f.eks. som kontekst
til idé 1 og 2), uten å committe selve OWL-filene til repoet.

## 8. 🟡 «Lagrede» spørringer trenger ikke fast endepunkt

I dag lagres `endpoint_name` sammen med spørringen (spesifikasjon.md § Innlogging).
Forslag: gjør lagring av endepunkt valgfri/informativ snarere enn styrende – man
velger uansett endepunkt på nytt når man trykker «Kjør». Trenger avklaring av hva
som skal skje med feltet som allerede finnes i `saved_queries.endpoint_name`.

---

## Diskusjon

**2026-09-11 – overordnet tilnærming (gjelder idé 1–5, 7):**
Regelbasert/snippet-basert der det går (fullføring, bNode/gyldighet-mønstre,
semester-binding), AI/LLM kun der det er reelt behov for å tolke fritekst
(regex-hjelp, idé 3). Se hver idé over for hva dette betyr konkret.

**Byggerekkefølge:** idé 7 (OWL-kunnskap) først, som grunnmur for idé 1 og 2.
Deretter trolig idé 4+5 (semester) som en avgrenset, ren regelbasert vinst, og
idé 6/8 som enkle UI/produkt-endringer uten avhengigheter.

**Idé 7 – status:** Are har lagt `Docs/ontologi-lowercase.ttl` (Turtle), lagt til
i `.gitignore` (`Docs/*.ttl`) så rå-OWL ikke committes. 44 klasser, 143
object/datatype-properties, hver med `rdfs:label`/`rdfs:comment` på nb+en, og
properties har også `rdfs:domain`/`rdfs:range` (nyttig bonus for idé 1 –
fullføring kan da filtrere properties på faktisk type, ikke bare liste alt).

Bekreftet empirisk mot Fuseki Beta (`SELECT DISTINCT ?type WHERE { ?s a ?type }`)
at ekte data bruker lowercase lokalnavn (`u:fagkode`, `u:kompetansemaalsett` …).
Det fantes også en `Uppercase`-variant av fila (RDFS-konvensjon, matcher ikke
dataene) – slettet, `lowercase`-varianten er kilden fremover.

**Lagring avgjort:** Supabase (appen har allerede et prosjekt der, org
«Ares Grep-sparql»). Ikke inn i selve SPARQL-endepunktet – det flushes og
lastes på nytt med ferske data hver natt,
så det er uansett feil sted for statisk OWL-kunnskap. Ikke nødvendigvis i
repoet heller (unngår å committe et generert artefakt som må holdes i synk).
Én-gangs manuell import nå (ikke automatisk resync – uklart hvor ofte OWL-fila
faktisk endrer seg).

**Bygget:**
- `supabase/migrations/003_ontology_terms.sql` – tabellen `ontology_terms`
  (nøkkel `(uri, kind)`, åpen lesing, skriving kun via secret-nøkkel).
- `scripts/import-ontology.mjs` – parser TTL-fila og upserter til Supabase.
  `npm run import-ontology` (evt. `-- --dry-run` for å teste uten å skrive).
- **Viktig funn under bygging:** fila bruker Protégé-block (`###  <uri>`) der
  12 lokalnavn (f.eks. `status`, `dokumenttype`, `kompetansemaalsett`) er
  deklarert *to ganger* – én gang som `owl:ObjectProperty`, én gang som
  `owl:Class` – med ulik label/comment per deklarasjon. Derfor er nøkkelen
  `(uri, kind)`, ikke `uri` alene, og scriptet parser block-for-block (ikke
  hele fila i ett) for ikke å blande sammen de to deklarasjonene. Verifisert
  med dry-run: 187 rader (44 class, 71 object_property, 72 datatype_property).

**Gjenstår før idé 1/2 kan bygge på dette:**
1. Kjør `supabase/migrations/003_ontology_terms.sql` i Supabase SQL-editor.
2. Fyll inn `SUPABASE_SECRET_KEY` i `.env.local` (samme som for øvrig admin-bruk).
3. Kjør `npm run import-ontology` for den faktiske importen.
