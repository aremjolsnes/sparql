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

**Debug-sesjon med Are (2026-09-11) – to lærdommer om OPTIONAL rundt mønsteret:**
Are prøvde å gjøre hele gyldighets-sjekken `OPTIONAL` (for å ta med koblinger
som helt mangler gyldighet, ikke bare de med delvis data) og støtte på to
klassiske SPARQL-feller, begge verdt å huske for videre verktøybygging:
1. En `#`-kommentar løper til linjeslutt – en glemt `}` etter en kommentert
   FILTER-linje kommenteres også bort, som gir ubalanserte klammer.
2. En variabel brukt i en `FILTER` *inni* en `OPTIONAL` må være bundet av noe
   som står *før* OPTIONAL-en i samme blokk – et mønster som binder variabelen
   *etter* OPTIONAL-en (tekstlig lenger nede) gjør at FILTER-et alltid feiler,
   uten synlig feilmelding (stille, gale resultater – verre enn en krasj).

Korrekt mønster (utenfor selve snippeten, siden det krever at brukeren
allerede har bestemt seg for at *hele* koblingen skal være optional):
```sparql
?of u:kode ?kode .
OPTIONAL {
  ?s ?gyldighetskobling ?bnode .
  FILTER isBlank(?bnode)
  FILTER (regex(str(?gyldighetskobling), ?kode))
  ?bnode u:gyldig-fra ?gyldigFra ;
         u:gyldig-til ?gyldigTil .
}
```
Utforsket videre om noen `u:laereplan_lk20` har *begge* deler (noen koblinger
med og noen uten gyldighet for samme læreplan) – bekreftet empirisk at dette
p.t. ikke finnes i dataene for `u:laereplan-referanse` spesifikt (kun 2
koblinger uten gyldighet totalt, og ingen av dem deler læreplan med en annen
kobling). Kontrollspørring med `GROUP BY … HAVING` for å sjekke dette i
fremtiden er dokumentert i selve samtalen, ikke gjentatt her.

**Utvidelse – nullpunkt/evighets-datoer for delvis manglende gyldighet
(2026-09-11):** Are påpekte at når bNoden *finnes* men mangler `gyldig-fra`
eller `gyldig-til` individuelt (ikke hele koblingen), kan vi binde fornuftige
standardverdier i stedet for å la dem stå ubundet: `gyldig-fra` mangler →
reformens nullpunkt (LK06: 2006-08-01, LK20: 2020-08-01), `gyldig-til`
mangler → en «evighets»-dato (9999-12-31). Gjør etterfølgende dato-FILTER
enklere (ingen egen håndtering av ubundne verdier).

Bygget inn i samme snippet (ikke separat/idé 4-5): `u:gyldig-fra`/`u:gyldig-
til` er nå hver for seg `OPTIONAL` (ikke hele mønsteret), med
`BIND (COALESCE(...) AS ?gyldigFra/?gyldigTil)` rett etter. LK06/LK20
gjenkjennes automatisk fra `a u:*_lk20` i blokka (samme mekanisme som
refVar-gjenkjenningen), LK06 er fallback. **Dette dekker fortsatt ikke**
tilfellet der bNoden mangler helt – det er den separate OPTIONAL-rundt-alt-
varianten over, som snippeten ikke bygger automatisk (bevisst valgt scope).

Verifisert: logikk-test (`tsx`, midlertidig) bekrefter riktig
2006-08-01/2020-08-01-valg per kontekst, og et komplett generert eksempel
kjørt direkte mot Fuseki Beta ga ekte gyldig-fra/-til-verdier (ingen
syntaksfeil).

**Bugfiks – dateTime vs. date (Are, 2026-09-11):** Are la merke til at ekte
`gyldig-fra`/`gyldig-til`-verdier har formen `2022-08-01T00:00:00`
(`xsd:dateTime`), mens datofilteret sammenlignet mot `^^xsd:date`. Bekreftet
empirisk mot Fuseki Beta at dette **feiler stille**: `dateTime <= date` gir
ingen verdi i det hele tatt (typefeil i uttrykket), ikke `false` – FILTER-et
ekskluderer da raden uten synlig feilmelding. Dette gjaldt egentlig hele
datofilter-delen av mønsteret helt siden første versjon, ikke bare den nye
COALESCE-biten.

Fiks: cast rådataene til `xsd:date` *inni* COALESCE
(`COALESCE(xsd:date(?gyldigFraRaa), "…"^^xsd:date)`), bekreftet at
`xsd:date(...)`-cast av en ubundet variabel også håndteres riktig av COALESCE
(faller trygt gjennom til fallback-verdien). Retestet fullt generert eksempel
direkte mot Fuseki Beta – datofilteret gir nå faktiske treff.

## 3. 🔵 Regex-hjelp

Regex er vanskelig å skrive riktig i FILTER/REGEX-uttrykk. Form for hjelp uklar ennå.

**Konkretisert (2026-09-11):** i motsetning til idé 1/2/7 er dette den ideen
som faktisk trenger et ekte LLM-kall (ikke bare regelbasert), siden
brukerens intensjon her er fritekst («match koder som starter på NOR», «alle
datoer i august») og ikke lar seg dekke av et fast snippet-mønster.
Rate-limiting/misbruk er ikke en reell bekymring – appen har p.t. maks 3-4
brukere (nærmeste kolleger).

**Valgt trigger – `#+`-kommentarlinje med tema:**
- Brukeren skriver `#+ regex: <beskrivelse>` eller `#+ filter: <beskrivelse>`
  på egen linje i spørringen.
- `#` er allerede kommentartegn i SPARQL, så linjen er gyldig/harmløs så
  lenge den ikke fremkalles – akkurat som gyldighets-snippeten i idé 2 ikke
  gjør noe før den velges.
- Fremkalles manuelt med **Ctrl+Space** (samme mønster som idé 1/2), ikke
  automatisk per tastetrykk – unngår AI-kall for hvert tastetrykk mens
  brukeren fortsatt formulerer beskrivelsen. `CompletionSource` i
  `@codemirror/autocomplete` støtter async/Promise, så AI-kallet kan henge
  på samme completion-arkitektur som resten av `sparqlCompletion.ts` i
  stedet for en egen knapp/UI.
- **Avgrenset til v1:** kun temaene `regex:` og `filter:`
  (`/^#\+\s*(regex|filter)\s*:\s*(.+)/i`). Flere temaer (f.eks. `semester:`
  for idé 4/5, hvis de en dag trenger fritekst-tolkning) kan legges til
  senere via samme mekanisme.
- **Ingen fallback ved manglende/ukjent tema:** `#+ tekst uten tema` gir
  ingen spesial-completion (faller tilbake til vanlig fullføring) – temaet
  er påkrevd, ikke valgfritt med en default, for å unngå å gjette brukerens
  intensjon.

**Gjenstår før dette kan bygges:** ny API-route (LLM-provider/nøkkel ikke
valgt ennå), promptdesign per tema (`regex:` → kun `regex(...)`-fragmentet;
`filter:` → trolig en hel `FILTER`/`OPTIONAL`-blokk, jf. idé 2), og hvordan
resultatet settes inn (sannsynligvis erstatning av hele `#+`-linjen, samme
`apply`-funksjon-mønster som idé 2s snippet).

**LLM-provider (2026-09-11):** Anthropic, gjenbruker en eksisterende
API-nøkkel fra et annet privat prosjekt (samme nøkkel kan brukes i flere
apper) – lagt til som `ANTHROPIC_API_KEY` i `.env.local`/`.env.example`.
Modell: `claude-haiku-4-5-20251001` (billig/rask nok for en kort
tekst-til-SPARQL-oversettelse).

**Bygget:**
- [app/api/ai-assist/route.ts](../app/api/ai-assist/route.ts) – tar
  `{ topic, description, context }`, validerer tema (`regex`/`filter`,
  ellers 400) og at beskrivelse ikke er tom, kaller Anthropics Messages API
  direkte via `fetch` (ingen ny SDK-avhengighet) med et systemprompt som gir
  faste prefikser og ber om rå SPARQL-tekst tilbake, ingen forklaring/
  Markdown. Ingen auth/rate-limiting – urealistisk med 3-4 kjente brukere.
  Mangler `ANTHROPIC_API_KEY` → 501, tydelig feilmelding.
- [lib/aiAssist.ts](../lib/aiAssist.ts) – tynn klient-fetch mot ruten over.
- [lib/sparqlCompletion.ts](../lib/sparqlCompletion.ts):
  `aiAssistCompletionSource()` – matcher `#+ regex: <beskrivelse>`/
  `#+ filter: <beskrivelse>` på kommentarlinja rett før cursor. Returnerer
  `null` (ingen completion) hvis: ikke fremkalt med `context.explicit`
  (Ctrl+Space), ukjent/manglende tema, eller tom beskrivelse – helt i tråd
  med "ingen fallback"-valget over. Sender hele spørringsteksten før
  `#+`-linja som kontekst (IKKE `currentBlock()`, som kutter ved siste "."
  og dermed ville skjult nettopp den forutgående trippelen AI-en trenger for
  å gjenkjenne variabler – dette var en reell bug funnet under testing, se
  under). Ved treff: ett `options`-forslag som viser starten av det
  genererte fragmentet i label, `apply` erstatter hele `#+`-linja med
  fragmentet. Ved feil (nettverk, tom API-nøkkel, …): ett forslag som viser
  feilmeldingen, med en no-op `apply` (linja endres ikke, så brukeren kan
  prøve igjen).
- [components/SparqlEditor.tsx](../components/SparqlEditor.tsx) – registrerer
  begge completion-kildene som en liste (`autocomplete: [...]`), CodeMirror
  slår dem sammen.

**Verifisert:** typecheck + lint rent (samme 2 pre-eksisterende
`react-hooks/refs`-feil i `SparqlEditor.tsx` som før, ingen nye – bekreftet
ved å diffe `eslint .`-output mot main). Ingen ekte nettleser tilgjengelig i
miljøet (samme sandboks-begrensning som idé 1/2). I stedet: (1) en
mocket-fetch-test (`tsx`, midlertidig, fjernet igjen) av selve
`aiAssistCompletionSource` med ekte `CompletionContext`/`EditorState`, som
avdekket kontekst-buggen over (context var nesten tomt før fiksen) og
bekreftet alle fire null-scenarioene (ikke explicit, ukjent tema, tom
beskrivelse) samt at `apply` faktisk erstatter riktig `from`/`to`-område med
det genererte fragmentet. (2) Et andre testløp kalte `POST` i
`app/api/ai-assist/route.ts` direkte (uten å starte en full Next-server) med
den ekte `ANTHROPIC_API_KEY` og fikk reelle, korrekte svar tilbake for begge
temaer – `regex: "match koder som starter på NOR eller ENG"` ga
`regex(str(?kode), "^(NOR|ENG)")` (gjenkjente `?kode` fra konteksten),
`filter: "gyldigFra skal være før eller lik 2023-01-01"` ga
`FILTER (?gyldigFra <= "2023-01-01"^^xsd:date)`. Ikke visuelt bekreftet i en
faktisk nettleser (Ctrl+Space-fremkalling, dropdown-visning).

**Bugfiks – to kilder som én array-verdi (Are, 2026-09-11):** Are testet i
ekte nettleser og fikk `Runtime TypeError: Cannot read properties of
undefined (reading 'length')` ved Ctrl+Space. Årsak: `SparqlEditor.tsx`
registrerte begge fullførings-kildene som **én** verdi –
`sparqlLanguage.data.of({ autocomplete: [sparqlCompletionSource(...),
aiAssistCompletionSource()] }) ` – men `@codemirror/autocomplete` tolker en
array-*verdi* på `autocomplete`-nøkkelen spesielt: den behandler den som en
statisk liste av `Completion`-objekter (bygger en kilde via
`completeFromList`), ikke som flere kilde-*funksjoner*. Siden elementene var
funksjoner uten `.label`, krasjet biblioteket internt når det forsøkte å
lese label-lengden. Riktig mønster (bekreftet med `state.languageDataAt(...)`
i en `tsx`-test, midlertidig, fjernet igjen – ga to separate
funksjons-verdier på posisjonen etter fiksen): **to separate**
`sparqlLanguage.data.of({ autocomplete: … })`-extensions, én per kilde, ikke
én extension med en array. Verdt å huske generelt: en array-verdi på et
CodeMirror-language-data-felt kan bety noe helt annet enn "flere
leverandører av samme felt", avhengig av hva feltet selv gjør med verdien.

Retestet av Are etter fiksen: `#+ filter: alle ?k som begynner på NOR` →
Ctrl+Space ga forslaget `FILTER(STRSTARTS(str(?k), "NOR"))`, og Enter satte
det inn i stedet for kommentarlinja – bekreftet fungerende i ekte nettleser
end-to-end.

**Justert etter Ares egen bruk (2026-09-11):** `#+ regex:` gir med vilje det
bare `regex(...)`-uttrykket – satt inn direkte som egen linje i en
WHERE-blokk er det ugyldig SPARQL (`regex(...)` må stå inni `FILTER(...)`
eller `BIND(...)`), noe Are traff på i praksis (parse error). Ikke en bug,
men et reelt forventningsgap: i stedet for å holde `regex:`/`filter:` som to
strengt adskilte formater, lot vi promptet for `regex:` følge beskrivelsen
hvis den selv sier hva resultatet skal brukes til – binding til en variabel,
eller pakket som filter – og ellers falle tilbake til det bare uttrykket.
`filter:`-temaet er uendret (alltid en komplett `FILTER(...)`-linje).

Verifisert med ekte kall mot Anthropic (`tsx`, midlertidig, fjernet igjen):
- `regex: "kode starter på NOR eller ENG"` (ingen ønsket bruk nevnt) →
  `regex(str(?kode), "^(NOR|ENG)")` (bart uttrykk, som før).
- `regex: "bind resultatet av å matche kode mot '^NOR' til variabelen
  ?erNorsk"` → `BIND(regex(str(?kode), "^NOR") AS ?erNorsk)`.
- `regex: "lag et filter som sjekker om kode starter på NOR"` →
  `FILTER(regex(str(?kode), "^NOR"))`.

**Bugfiks – hallusinert `UNDEF` utenfor VALUES (Are, 2026-09-11):** Ares
beskrivelse "?k starter på NOR eller ENG, ... og binde det til ?kode" (en
reell betinget-binding-bruk av `regex:`-fleksibiliteten over) ga
`BIND(IF(regex(str(?k), "^(NOR|ENG)", "i"), ?k, UNDEF) AS ?kode)` –
parse error i praksis. `UNDEF` er kun gyldig syntaks inni en `VALUES`-blokk,
ikke som en generell "ingen verdi"-gren i `IF(...)`/`COALESCE(...)`, men
Haiku hallusinerte det som om det var lovlig der. En første promptfiks (bare
en advarsel om at `UNDEF` er begrenset til `VALUES`) var IKKE nok – samme
feil gjentok seg uendret ved retest. Det som faktisk virket: gi modellen et
konkret korrekt eksempel å følge i stedet for en abstrakt regel – riktig
SPARQL-idiom for en betinget ubundet variabel er å referere til en variabel
som ikke er bundet noe annet sted i spørringen (gir en evalueringsfeil som
lar `BIND`-målet forbli ubundet for raden, uten at hele spørringen feiler).
Lagt inn i systemprompten med eksplisitt eksempel
(`BIND(IF(vilkår, ?k, ?ub) AS ?kode)`, ikke `UNDEF`). Retestet med Ares
eksakte beskrivelse (`tsx`, midlertidig, fjernet igjen): ga nå
`BIND(IF(regex(str(?k), "^(NOR|ENG)", "i"), ?k, ?ubundet) AS ?kode)` – gyldig
SPARQL. Regresjonstestet samtidig at default-regex og filter-temaet fortsatt
ga riktige svar som før.

**Driftserfaring fra Are – "filtrer" vs. "binde" i beskrivelsen
(2026-09-11):** den gyldige `BIND(IF(regex(...), ?k, ?ubundet) AS ?kode)`
over gir *ikke* det man intuitivt venter av "koder som starter på NOR/ENG".
`BIND`/`IF` ekskluderer ingen rader – den kjører for hver eneste `?s`/`?k`,
og lar bare `?kode` stå ubundet (vist som "–" i resultattabellen) på rader
som ikke matcher. Med `SELECT *` ser man dermed alle rader, matchende og
ikke. `SELECT DISTINCT ?kode` hjelper heller ikke – alle de ubundne radene
er like på `?kode` og kollapser til én ekstra "–"-rad, i stedet for å
forsvinne. Riktig verktøy for "bare kodene som matcher" er `FILTER`
(ekskluderer raden), ikke `BIND(IF(...))` (beholder raden, gir en betinget
verdi) – de løser to forskjellige behov. Tommelfingerregel for
beskrivelsen fremover: skriv "filtrer på …" når du vil ekskludere rader,
reserver "bind … til" for når du faktisk vil beholde alle radene og legge
på en utledet verdi (f.eks. et sant/usant-flagg).

**Hjelpeside (2026-09-11):** [app/hjelp/page.tsx](../app/hjelp/page.tsx) –
statisk side som beskriver og gir eksempler for alle tre støtteverktøyene
(u:-fullføring, gyldighet-mønster, `#+ regex:`/`#+ filter:`), inkl.
fallgruven over. Lenket fra et «(?)»-ikon i toppmenyen i
[app/page.tsx](../app/page.tsx) (åpner i ny fane).

**Verifisert:** typecheck + lint rent (samme 8 pre-eksisterende feil som før
– inkl. én i `app/profil/page.tsx` for nøyaktig samme `<a href="/">`-mønster
jeg først kopierte inn i den nye sida, fikset til `next/link`s `<Link>` der
i stedet for å gjenta den pre-eksisterende feilen). Hentet `/hjelp` og `/`
via `curl` mot den kjørende dev-serveren (localhost:3000) – begge svarer
200, og forventet innhold (bl.a. "Fallgruve", "erNordisk") er med i
HTML-en. Siden hovedsiden er en client component som kun server-rendrer en
"Laster …"-tilstand, kunne ikke selve «(?)»-lenken bekreftes med `curl` –
samme sandboks-begrensning som resten av idé 3 (ingen ekte nettleser
tilgjengelig). Ikke visuelt bekreftet.

**Flere `#+`-temaer å vurdere (forslag, ikke bygget, 2026-09-11):**
- `semester:` – direkte kobling til idé 4/5 under (semester→dato-binding).
  Kunne gjenbrukt denne mekanismen i stedet for separat regelbasert logikk,
  men idé 4/5s åpne punkt om datointervall må avklares først.
- `optional:` – adresserer de to SPARQL-fellene fra idé 2s debug-sesjon
  (kommentar som sluker en `}`, FILTER som refererer en variabel bundet
  *etter* OPTIONAL – stille, gale resultater). Vurdert som mest verdt å
  bygge av forslagene under, siden den treffer et reelt, dokumentert
  feilmønster.
- `path:` – property paths (`+`, `*`, `?`, `/`, `|`, `^`) er fiffig syntaks
  å huske riktig.
- `values:` – bygge en `VALUES ?var { … }`-blokk fra en fritekst-liste med
  koder.
- `order:` – `ORDER BY`-uttrykk fra en beskrivelse av ønsket sortering.

## 4. 🔵 Bind semester til dato

Vårsemester: åååå-01-01 til åååå-07-31. Høstsemester: åååå-08-01 til åååå-12-31.

Typiske verdier: `http://psi.udir.no/kl06/semester_hoest_2007`,
`http://psi.udir.no/kl06/semester_vaar_2021`.

Ønske: hjelp til å binde ting som `u:foerste-semester` (eller `u:*-foerste-semester`)
til faktiske datoer, slik at man kan filtrere med `<=`, `=`, `>=` mot datoverdier
i stedet for mot semester-URI-er direkte.

**Bekreftet mot ekte data (2026-09-11):** spurte Fuseki Beta for properties med
"semester" i navnet – 6 stk, ikke bare `foerste-semester`: `u:foerste-semester`/
`u:siste-semester` (domain `u:programomraade`, `u:utdanningsprogram`) og
`u:naar-gis-det-undervisning-foerste-semester`/`-siste-semester` +
`u:naar-kan-man-ta-eksamen-foerste-semester`/`-siste-semester` (begge domain
`u:fagkode`). Alle 6 har `rdfs:range u:semester` riktig deklarert i OWL-fila
(idé 7) – bekreftet ved grep i `Docs/ontologi-lowercase.ttl`.

Sjekket om selve semester-ressursen (f.eks. `d:semester_hoest_2020`) har egne
datoer å hente i stedet for å gjette kalenderhalvår: den har kun `u:tittel`
("Høst 2020"), `u:kortform` ("H20") og `u:rekkefoelge` (et løpenummer) – ingen
datoer. Kalenderhalvår-antagelsen i overskriften er dermed fortsatt en bevisst
forenkling, ikke noe bekreftet fra dataene – Are bekreftet at dette holder
(samme presisjonsnivå som gyldighet-mønsteret i idé 2 bruker for filtrering).

**Presisert av Are (2026-09-11) – spennet er start-til-slutt, ikke start-til-start:**
det Are faktisk er ute etter er *varigheten* for et objekt: fra start av
"første"-semesteret til **slutt** av "siste"-semesteret. Altså aug-01/jan-01
for `foerste-semester`-siden, men des-31/jul-31 for `siste-semester`-siden
(ikke aug-01/jan-01 for begge).

**Slått sammen med idé 5** (samme vurdering som idé 2 gjorde: filterhjelpen
bygges inn i selve snippeten, ikke som en egen separat greie).

**Valgt løsning – ikke hardkodet liste, men autodetekterte par:** propertyene
pares automatisk ved å finne `<prefiks>foerste-semester`/`<prefiks>siste-
semester` blant properties med `range = u:semester` i OWL-kunnskapen (idé 7).
Gir tre par i dag (det bare paret, undervisning-paret, eksamen-paret) uten at
noen av de 6 navnene står hardkodet i koden – nye par med samme
navnemønster plukkes opp automatisk hvis Udir legger dem til senere.

**Bygget:** [lib/sparqlCompletion.ts](../lib/sparqlCompletion.ts) –
`findSemesterPairs()` finner parene og domenet deres fra OWL-kunnskapen,
`buildSemesterVarighetSnippetTemplate()` bygger selve snippeten. Vises som
et eget forslag («semester-varighet», eller «semester-varighet (undervisning)»
/«semester-varighet (eksamen)» når flere par matcher samme type) i
`u:`-dropdownen i property-posisjon – domene-filtrert som idé 1 (i motsetning
til gyldighet-mønsteret i idé 2, som bevisst vises uansett domene: her gir det
derimot ikke mening å foreslå semester-varighet for en type som ikke har noen
semester-property). Setter inn begge propertyene i paret (fortsetter fra `;`,
ingen gjentagelse av subjektet – samme prinsipp som gyldighet-mønsteret), pluss
BIND-linjer som trekker ut sesong (hoest/vaar) og årstall fra semester-URI-en
med `STRAFTER`/`CONTAINS`, og et `FILTER` mot en `${dato}`-tab-stopp.

**Verifisert:** typecheck + lint rent (samme 8 pre-eksisterende feil).
Logikk-test (`tsx`, midlertidig, fjernet igjen) med en minimal `{state,
dispatch}`-editor (samme teknikk som idé 2, men denne gangen med reell
`state.update(spec)` i mock-dispatchen – et første forsøk med en for enkel
mock ga et krasj og deretter dobbel/`undefined`-tekst i output, fikset ved å
la `dispatch` lese `tx.state` direkte i stedet for å prøve å parse
`tx.changes` selv) bekreftet: riktig par-gjenkjenning og domene-filtrering
(0 forslag for en type uten semester-par), og at innsatt tekst er gyldig
SPARQL-fortsettelse fra `;` (en første versjon gjentok subjektet unødvendig
foran – ga en syntaktisk ugyldig `; ?s u:...`-sekvens, fjernet). Kjørte
deretter det fullstendige genererte mønsteret direkte mot Fuseki Beta for
begge domene-variantene: `semester_hoest_2007` → `2007-08-01`,
`semester_vaar_2021` → `2021-07-31` (og tilsvarende for flere andre
år/rader) – riktig utregnet i alle tilfeller, og FILTER mot en gitt dato
returnerte kun rader der spennet faktisk dekker datoen.

## 6. 🔵 Prefiks i tabell, hel URI i CSV

Vis forkortet form (`d:NOR01-07`) for URI-er i resultattabellen, men full URI ved
CSV-eksport.

**Avklart mot Are (2026-09-11):** alle tre endepunktene er strukturelt like, så
forkortingen trenger ikke vite hvilket endepunkt resultatet kom fra – det holder å
kjenne igjen alle kjente prefiks-*varianter* (i dag `st:`s to endepunkt-varianter,
se `KNOWN_PREFIX_VARIANTS` i `lib/prefixes.ts`) i én delt tabell, i stedet for å
tre endepunkt-state inn i resultattabell-komponenten.

**Bygget:** `shortenUri()` i [lib/prefixes.ts](../lib/prefixes.ts) – lengste
matchende kjente prefiks-verdi (faste prefikser + alle kjente varianter) vinner,
returnerer URI-en uendret hvis ingen matcher eller lokalnavnet ville blitt tomt.
Brukt kun som visningstekst i `Cell` i
[components/ResultsTable.tsx](../components/ResultsTable.tsx) – `href` peker
fortsatt til full URI, og en `title` med full URI vises ved hover når teksten er
forkortet. CSV-eksport (`toCsv` i `lib/sparql.ts`) var allerede uendret av dette –
den brukte alltid `.value` (full URI) direkte, ingen kode å endre der.
Spec oppdatert (§ Resultathåndtering, § Innlogging) for å matche.

**Verifisert:** typecheck + lint rent (samme 8 pre-eksisterende feil). Egen
sanity-test (`tsx`, midlertidig, fjernet igjen) av `shortenUri()` mot 7 tilfeller
– begge `st:`-variantene, alle faste prefikser, en urelatert URI (uendret) og en
URI uten lokalnavn (uendret) – alle 7 passerte.

## 7. 🔵 Bygg inn OWL-kunnskap (labels/definisjoner)

Udirs OWL-filer (ikke i repoet) inneholder først og fremst `rdfs:label` og
definisjoner/beskrivelser ment for menneskelig forståelse av typer og egenskaper.
Ønske: gjøre denne kunnskapen tilgjengelig for AI-støtten i appen (f.eks. som kontekst
til idé 1 og 2), uten å committe selve OWL-filene til repoet.

## 8. 🔵 «Lagrede» spørringer trenger ikke fast endepunkt

I dag lagres `endpoint_name` sammen med spørringen (spesifikasjon.md § Innlogging).
Forslag: gjør lagring av endepunkt valgfri/informativ snarere enn styrende – man
velger uansett endepunkt på nytt når man trykker «Kjør».

**Avklart:** feltet `saved_queries.endpoint_name` beholdes uendret (ingen
DB-migrasjon) – det er kun *lese*-siden (hva som skjer når en lagret spørring
åpnes) som endres. Skriving (Lagre/Overskriv) og visning (grå tekst under
tittelen i «Lagrede»-lista) er uendret.

**Bygget:** [app/page.tsx](../app/page.tsx) – `openSavedInNewTab` kaller ikke
lenger `setEndpointName(sq.endpoint_name)`. Én linje fjernet, resten av
funksjonen (ny fane, aktiver den) uendret. Spec oppdatert (§ Innlogging).

**Verifisert:** typecheck + lint rent (samme 8 pre-eksisterende feil). Ren
kodefjerning uten ny logikk å teste isolert – ikke visuelt bekreftet i en
faktisk nettleser (samme miljøbegrensning som resten av loggen).

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
