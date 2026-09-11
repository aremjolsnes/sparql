# Spesifikasjon – SPARQL-workbench mot Grep

Dette dokumentet er den omforente spec-en etter gjennomgang av [instruksjoner.md](instruksjoner.md).
`instruksjoner.md` beholdes som opprinnelig idébeskrivelse; dette dokumentet gjelder ved uenighet.

## Formål

En webbasert SPARQL-workbench for Grep der man skriver en SPARQL-spørring i klartekst,
kjører den mot et valgt endepunkt, og får resultatet som en paginert tabell.
Inspirert av GraphDB Workbench (se [screenshot.png](screenshot.png)), men med mørkt tema.

## Endepunkter

Listen ligger server-side (env-var / konfigfil). Bare visningsnavnet vises i UI-et.

| Visningsnavn      | URL                                                                                          | Merknad          |
|-------------------|--------------------------------------------------------------------------------------------- |------------------|
| Fuseki Beta       | `http://ca-sparql-beta.whitedune-e5bf55cb.norwayeast.azurecontainerapps.io/201906/query`    | Default          |
| Beta              | `https://sparql-beta-data.udir.no/repositories/201906`                                       |                  |
| Prod              | `https://sparql-data.udir.no/repositories/201906`                                            |                  |

- Azure-endepunktet bruker SPARQL-protokollstien `/201906/query`; GraphDB-endepunktene bruker
  `/repositories/201906`. Begge tar samme POST-form.
- Alle tre er nåbare fra offentlig internett, så backend-proxy fungerer for alle.
- Endepunktet har en egen tidsgrense på 2 minutter.

### Egendefinerte endepunkter

Tannhjul til høyre for endepunktsvalget åpner en modal der brukeren kan legge til / fjerne
egne endepunkter (URL + visningsnavn). Disse lagres i `localStorage`. De tre innebygde
kan ikke fjernes.

**Ute av scope nå:** Test- og QA-endepunktene (`sparql-test-data` / `sparql-qa-data`),
fordi de kun er nåbare via Udir-VPN og dermed ikke fra Vercel.

## Arkitektur

- **Frontend:** Next.js (App Router, TypeScript), mørkt tema. Editor: CodeMirror 6 med SPARQL-støtte.
- **Backend:** Next.js Route Handler som proxy mot valgt endepunkt.
- **Hosting:** Vercel. Repo: `https://github.com/aremjolsnes/sparql.git`
- Ingen database, ingen innlogging i denne versjonen. Appen er åpen.

### Backend-proxy

- `fetch` med `POST`, `Content-Type: application/x-www-form-urlencoded`, body `query=<encodet>`.
- `Accept: application/sparql-results+json`.
- Streamer upstream-responsen videre til klienten (ikke bufre), for å unngå Vercels
  responsstørrelsesgrense ved store resultater.
- Måler tidsbruk (wall-clock) på serveren og returnerer dette til frontend.
- **Backstop-grense:** hvis spørringen ikke selv inneholder `LIMIT`, legg på `LIMIT 50000`
  (konfigurerbart). Treffes taket, vises en tydelig melding i UI-et om at resultatet er avkortet.
- **Feilhåndtering:** ved HTTP 400 fra endepunktet, vis parser-/feilmeldingen fra responsen
  i et rødt panel i UI-et.
- `maxDuration` for funksjonen settes så høyt Vercel-planen tillater (Hobby: 60 s, Pro: 300 s).
  Endepunktets egen grense er 2 min; på Hobby-plan kan lange spørringer bli kuttet ved 60 s.

## Paginering

**Hent-alt, paginer i visningen.**

- Backend henter hele resultatsettet i ett kall.
- Frontend holder hele settet i minne, men rendrer kun én side om gangen (1000 rader/side).
- Gir eksakt totaltall («av N») gratis, uten separat COUNT-spørring.
- Ingen `LIMIT`/`OFFSET`-injisering, ingen spørrings-omskriving, ingen ustabil radrekkefølge
  mellom sider.
- Sortering gjøres i spørringen (`ORDER BY`), så settet kommer i ønsket rekkefølge.

Pagineringslenker: sidene nummereres `1 2 3 …`. Gjeldende side er ikke klikkbar; øvrige er.
Plasseres mellom skrivefeltet og resultatet, til høyre. «Last ned som CSV» plasseres til
venstre for pagineringen.

## Prefikser

Faste prefikser appen kjenner:

```
PREFIX d:    <http://psi.udir.no/kl06/>
PREFIX u:    <http://psi.udir.no/ontologi/kl06/>
PREFIX st:   <https://data.udir.no/kl06/v201906/status/status_>
PREFIX rdf:  <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd:  <http://www.w3.org/2001/XMLSchema#>
```

Ved klikk på «Kjør»:
1. Skann spørringen for prefiks-tokens (`d:`, `u:`, `st:`, `rdf:`, `rdfs:`, `xsd:`) som
   brukes, men ikke allerede er deklarert med en `PREFIX`-linje.
2. Sett inn de manglende `PREFIX`-linjene øverst i spørringen.
3. Oppdater editor-innholdet så endringen er synlig for brukeren.
4. Kjør spørringen.

Brukerens egne, ekstra prefikser skal beholdes. Tokens inne i strenger/IRI-er skal ignoreres.

## Layout

Mørkt tema. Ikke pixel-tro kopi av GraphDB – funksjonaliteten er det viktige.

- **Øverst til venstre:** overskrift «SPARQL-workbench mot Grep».
- **Øverst til høyre:** endepunktsvalg (nedtrekk med visningsnavn) + tannhjul for endepunkt-modal.
- **Øverst til høyre, knapperad:** «Kun editor» / «Editor og resultater» / «Kun resultater».
  Midterste valgt som default.
- **Faner** over skrivefeltet:
  - Én fane vises i utgangspunktet, med en liten «+»-fane til høyre som lager ny fane.
  - Nye faner heter «Uten navn» (grå skrift) til de navngis.
  - Dobbeltklikk på fanen for å skrive inn navn; navngitt fane vises med normal (svart/hvit) skrift.
  - Faner, navn og spørringstekst persisteres i `localStorage`.
- **Skrivefelt:** ferdigutfylt med en enkel `?s ?p ?o`-spørring.
  - Knapp nederst til høyre: «Kjør». Hurtigtast: Ctrl+Enter / Cmd+Enter.
- **Mellom skrivefelt og resultat:** «Last ned som CSV» (til venstre) og paginering (til høyre).
  «Last ned som CSV» er utvidbar med flere formater senere (JSON m.fl.).
- **Over tabellen, høyrejustert:** statuslinje, f.eks.
  «Viser resultater fra 1 til 1000 av 2158. Spørringen tok 0,5 sek, 2026-09-10 12:14».
  Aktuelle tall, faktisk tidsbruk, og dato/klokkeslett for kjøringen.
- **Resultattabell:** første rad er kolonneoverskrifter fra `head.vars` (SELECT-variablene,
  i rekkefølge). Sticky header, horisontal scroll ved brede tabeller.

## Resultathåndtering

- **SELECT:** tabell fra `results.bindings`.
- **ASK:** vis `true` / `false`.
- **CONSTRUCT / DESCRIBE:** vis rå respons med en melding om at grafresultat ikke tabuleres
  (kan bygges ut senere).
- Celler:
  - IRI: vis forkortet form (`prefiks:lokalnavn`, kjente prefikser inkl. kjente
    endepunkt-varianter av `st:`) i tabellen, gjør den klikkbar mot full URI (`title`
    viser full URI ved hover). CSV-eksport bruker fortsatt full URI, ikke forkortet form.
  - Typet literal: vis verdi (evt. med datatype-indikator).
  - Literal med språktagg: vis verdi med `@nb`-tagg.
  - Ubundet variabel: tom celle.
- **CSV-nedlasting:** korrekt escaping (anførselstegn, komma, linjeskift) og vern mot
  formel-injeksjon (celler som starter med `= + - @` prefikses).
- Ingen klikk-sortering eller kolonnefilter i UI-et i denne versjonen – sortering gjøres i
  spørringen.

## Feil og grensetilfeller

- Syntaksfeil / HTTP 400: vis endepunktets feilmelding i rødt panel.
- Timeout: tydelig melding om at spørringen brukte for lang tid.
- Avkortet resultat (backstop `LIMIT` truffet): tydelig melding.
- Nettverksfeil mot endepunkt: tydelig melding.
- Tegnsett: UTF-8 hele veien (æ ø å).

## Innlogging, lagrede spørringer og fane-synk (lagt til)

**Prinsipp:** appen er fortsatt **åpen** – innlogging er valgfritt og låser bare opp
per-bruker-lagring. Ingen proxy/redirect-gating.

**Auth:** Supabase Auth (e-post + passord), eget Supabase-prosjekt på Free-planen
(org «Ares Grep-sparql», Frankfurt). Klient-side auth med `@supabase/ssr`.
Miljøvariabler: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`SUPABASE_SECRET_KEY`.

**Brukere:** admin oppretter brukere på `/admin` med e-post + midlertidig passord
(`auth.admin.createUser`), ingen invitasjons-e-post. Brukeren bytter passord selv via
«Bytt passord» i topplinja. `aremjolsnes@gmail.com` tvinges til `admin` av DB-trigger.
`/api/admin/users` er beskyttet med `Authorization: Bearer <access_token>` + admin-sjekk
via secret-nøkkelen. Første admin må opprettes manuelt i Supabase (Auth → Users).

**DB (Postgres + RLS «kun egne rader»):**
- `profiles` (id = auth-bruker, email, role, created_at) – fylles av trigger på `auth.users`.
- `saved_queries` (id, user_id, title, query, endpoint_name, created_at, updated_at).
- `user_tabs` (user_id PK, data jsonb, active_id, updated_at) – hele fane-arrayen som blob.

**Frontend:**
- Innlogget: faner synkes til `user_tabs` (debouncet ~0,8 s); ved lasting vinner DB over
  `localStorage`. Utlogget: `localStorage` som før.
- «Lagre spørring» (tittel foreslått fra fanenavn / første linje) + «Lagrede»-nedtrekk i
  editor-verktøylinja → åpner valgt spørring i **ny fane**. `endpoint_name` lagres og vises
  som informasjon under tittelen, men styrer ikke lenger aktivt endepunkt ved åpning – man
  velger selv endepunkt og trykker «Kjør» (idé 8, se Docs/ideer-ai-stotte.md). Overskriv /
  gi nytt navn / slett.

**Drift:** `/api/health` gjør et lite DB-kall; `vercel.json` cron (`0 6 * * *`) kaller den
daglig så gratis-Supabase ikke pauses etter 7 dager.

Migrasjon: `supabase/migrations/001_auth_and_storage.sql`.

## Ute av scope (kan bygges ut senere)

- Invitasjons-e-post (bruker admin-opprettet passord i stedet).
- Test- og QA-endepunkter (VPN).
- Klikk-sortering og kolonnefilter i resultattabellen.
- Flere nedlastingsformater enn CSV.
- Pivot-tabell / diagram-visninger (jf. GraphDB).
