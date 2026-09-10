# SPARQL-workbench mot Grep

Webbasert SPARQL-workbench for Grep. Skriv en spørring i klartekst, kjør den mot et valgt
endepunkt, og få resultatet som en paginert tabell. Mørkt tema.

Full spec: [Docs/spesifikasjon.md](Docs/spesifikasjon.md).

## Kom i gang lokalt

```bash
npm install
npm run dev
```

Åpne http://localhost:3000.

## Hvordan det virker

- **Frontend** (`app/page.tsx` + `components/`): CodeMirror-editor med SPARQL-støtte, faner
  (lagret i `localStorage`), endepunktsvalg med modal for egendefinerte endepunkter, og en
  resultattabell som paginerer i visningen.
- **Backend** (`app/api/query/route.ts`): proxy som POST-er spørringen til valgt endepunkt
  (`application/x-www-form-urlencoded`, `Accept: application/sparql-results+json`), måler
  tidsbruk, og legger på en backstop-`LIMIT` hvis spørringen ikke har en selv. Enkelt
  SSRF-vern blokkerer interne adresser for egendefinerte endepunkter.
- **Paginering**: hele resultatsettet hentes i ett kall og pagineres i frontend, slik at
  totaltallet («av N») blir eksakt uten en egen COUNT-spørring.

## Konfigurasjon

Se [.env.example](.env.example). Ingen variabler er påkrevd.

## Deploy (Vercel)

Importer repoet i Vercel. Ingen build-konfig kreves. På Hobby-plan er funksjons-timeout
60 sek; endepunktet har selv 2 min grense, så tunge spørringer kan kreve Pro-plan
(`maxDuration` er satt til 300 i route-en).

## Ute av scope foreløpig

Innlogging, Test/QA-endepunkter (VPN), klikk-sortering i tabellen, flere nedlastingsformater.
