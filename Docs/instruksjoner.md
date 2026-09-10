## Bakgrunn
Jeg ønsker å lage en SPARQL-workbench for Grep der jeg kan skrive en SPARQL-spørring (ikke URL-enkodet) og klikke "Kjør" (evt Ctrl+Enter), så sendes spørringen URL-enkodet til maskin-endepunktet http://ca-sparql-beta.whitedune-e5bf55cb.norwayeast.azurecontainerapps.io/201906/query. Jeg foreslår at vi backend bruker Curl (typ `curl -H "Accept:application/json"`) etterfulgt av den URL-enkodede spørringen. Frontend tar imot json-returen/resultatet og skriver ut en tabell der første rad består av SELECT-elementene. 

## Paginering
Radene nummeres, og vi kan paginere slik at hvis vi får flere enn 1000 treff, så har vi lenker til hver side, typ `1 2 3` der hver side lenker til OFFSET n der, hvis n er 2 så vises tabellen fra 2001 til 3000. Dette kan løses slik at vi backend smetter inn `LIMIT 1000` i spørringen i utgangspunktet, men hvis det er flere enn 1000 treff, så ser vi en lenke til 2 som når brukeren klikker på 2 så kjøres spørringen, men da med `LIMIT 1000 OFFSET 2000` osv. Vi viser både 1 og 2, men bare 2 er klikkbar. Når vi har klikket på 2, så er det 1 som er klikkbar, og evt. de som er over 2 hvis det er noen.

## Faner med spørringer
Over skrivefeltet kan vi ha faner som vi kan navngi, slik at vi kan jobbe med flere spørringer. I utgangspunktet vises bare én fane, men vi har en liten fane med "+" til høyre for utgangsfanen som ved klikk på denne ("+") lager en ny fane. Før brukeren evt. gir fanene navn, kan de hete "Uten navn" (vises med grå skrift), inntil vi dobbeltklikker på fanen og skriver inn et navn og da blir skriften svart.

## Layout på siden
- Øverst til høyre: Velge endepunkt. Foreløpig bare http://ca-sparql-beta.whitedune-e5bf55cb.norwayeast.azurecontainerapps.io/201906/query (Visningsnavn "Fuseki Beta"), men ved klikk på tannhjul til høyre for endepunktsvalget, modal hvor brukeren kan legge til og trekke fra endepunkt (URL + visningsnavn). Det er visningsnavnet som vises i rullegardinsvalget
- Overskrift øverst på venstre side: "SPARQL-workbench mot Grep"
- Knapper øverst til høyre: "Kun editor" "Editor og resultater" "Kun resultater" (den midterste er valgt pr default)
- Skrivefelt (ferdigutfylt en ?s ?p ?o-spørring)
- Knapp nederst til høyre i skrivefeltet: "Kjør"
- Etter at man har trykket "Kjør" vises resultatet som tabell under skrivefeltet, men med plassholder for paginering mellom skrivefeltet og resultatet, til høyre under skrivefeltet.
- Knapp: "Last ned som SCV" (kan utvides med flere valg senere (json m. fl)). Plasseres til venstre for pagineringen (forrige punkt)
- Over tabellen, men under evt paginering: "Viser resultater fra 1 til 1000. Spørringen tok 0,5 sek, 2026-08-31 12:14". Dette var bare et eksempel, men vis aktuelle tall for paginering og antall sekunder, og aktuell dato med klokkeslett. Høyrejusteres.

Layouten som er beskrevet over er basert på GraphDB sin Workbench. Se vedlagte screenshot.png og bruk det gjerne som inspirasjon, men jeg vil gjerne ha mørkt tema.

## Prefikser
I Grep har vi noen faste prefikser:
PREFIX d: <http://psi.udir.no/kl06/>
PREFIX u: <http://psi.udir.no/ontologi/kl06/>
PREFIX st: <https://data.udir.no/kl06/v201906/status/status_>
PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

Derfor, hvis brukeren i skrivefeltet skriver f.eks. "u:", så vil jeg at "PREFIX u: <http://psi.udir.no/ontologi/kl06/>" automatisk fylles ut øverst osv.

## Arkitektur
Jeg har forberedt følgende:
- Github: https://github.com/aremjolsnes/sparql.git
- Vercel: (jeg skriver inn URL her etter første deploy (jeg får ikke importert før jeg har noe i repoet))

