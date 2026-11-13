import { SANDBOX_PREFIXES } from "@/lib/prefixes";

/** En side i dokumentasjonen til et endepunkt: en Markdown-fil i et GitHub-repo. */
export type DocPage = {
  /** Kort navn i adressen: /dokumentasjon?endepunkt=<name>&side=<id> */
  id: string;
  /** Navn i sidemenyen */
  label: string;
  /** Overskrift for gruppen i sidemenyen. Sider med samme gruppe står sammen. */
  group: string;
  /** Rå Markdown-fil som hentes og vises */
  markdownUrl: string;
  /** Siden der filen ligger (GitHub), for lenken «Kilde» og for relative lenker i filen */
  sourceUrl: string;
  /** Andre GitHub-adresser som skal føre hit, for eksempel forsiden til repoet for en README */
  aliases?: string[];
};

/** Lager en DocPage for en Markdown-fil på main i et repo under github.com/aremjolsnes. */
function githubSide(
  side: Pick<DocPage, "id" | "label" | "group">,
  repo: string,
  fil: string,
): DocPage {
  const repoUrl = `https://github.com/aremjolsnes/${repo}`;
  return {
    ...side,
    markdownUrl: `https://raw.githubusercontent.com/aremjolsnes/${repo}/refs/heads/main/${fil}`,
    sourceUrl: `${repoUrl}/blob/main/${fil}`,
    // README-en er forsiden til repoet, så lenker til repoet skal føre til den
    aliases: fil === "README.md" ? [repoUrl] : undefined,
  };
}

const SANDKASSEN = "Sandkassen";
const LAEREPLAN_PROMPT = "Anvendelse: laereplan-prompt";

export type Endpoint = {
  /** Visningsnavn i nedtrekksmenyen */
  name: string;
  /** Full URL til query-endepunktet */
  url: string;
  /** Innebygde endepunkter kan ikke fjernes i UI-et */
  builtin?: boolean;
  /**
   * Ekstra prefikser for dette endepunktet, eller overstyringer av FIXED_PREFIXES. Slås sammen
   * med de faste i ensurePrefixes, så brukeren kan skrive `udir:` osv. uten PREFIX-linje.
   * Sandkassen bruker det til sine egne navnerom (udir:, owl:, skos:, dcterms:, schema:, text:, styrk:, isco:, dcat:, void:, nus:, iscedf:, isced2011:, esco:, sssom:, semapv:).
   */
  prefixes?: Record<string, string>;
  /**
   * Brukerdokumentasjon for endepunktet, som en liten wiki. Når den finnes, vises et ikon i topplinjen
   * som åpner /dokumentasjon?endepunkt=<name>. Sidene er Markdown-filer som ligger i sine egne repoer
   * på GitHub og hentes derfra. Lenker mellom sidene skrives som vanlige GitHub-lenker i filene, og
   * gjøres om til lenker innenfor wikien når de vises her.
   */
  docs?: {
    /** Navn på wikien, vist i topplinjen og over sidemenyen */
    title: string;
    /** Sidene. Den første er forsiden. */
    pages: DocPage[];
  };
};

/**
 * Innebygde endepunkter. Test/QA er utelatt med vilje – de er kun nåbare via Udir-VPN.
 * Beta kjører Jena Fuseki; Prod kjører GraphDB fram til Fuseki-byttet 9. november 2026.
 * Sandkassen er Fuseki på Fly.io med samme data pluss ontologi og normalisering.
 */
export const BUILTIN_ENDPOINTS: Endpoint[] = [
  {
    name: "Beta",
    url: "https://sparql-beta-data.udir.no/repositories/201906",
    builtin: true,
  },
  {
    name: "Prod",
    url: "https://sparql-data.udir.no/repositories/201906",
    builtin: true,
  },
  {
    // Grep-sandkassen (repo aremjolsnes/grep-jena-fuseki): Prod-dumpen lastet inn nattlig, med
    // ontologi og normaliserte grafer. Fly-maskinen stopper ved inaktivitet, så første spørring
    // etter en pause kan bruke 10–20 sekunder ekstra på oppstart.
    name: "Sandkassen",
    url: "https://grep-fuseki-v3.fly.dev/ds/query",
    builtin: true,
    prefixes: SANDBOX_PREFIXES,
    docs: {
      title: "Sandkassen: Dokumentasjon",
      pages: [
        githubSide(
          { id: "bruk", label: "Brukerveiledning", group: SANDKASSEN },
          "grep-jena-fuseki",
          "docs/bruk.md",
        ),
        githubSide(
          { id: "drift", label: "Drift og oppsett", group: SANDKASSEN },
          "grep-jena-fuseki",
          "README.md",
        ),
        githubSide(
          { id: "laereplan-prompt", label: "Oversikt", group: LAEREPLAN_PROMPT },
          "laereplan-prompt",
          "README.md",
        ),
        githubSide(
          { id: "laereplan-prompt-demo", label: "Demomanus", group: LAEREPLAN_PROMPT },
          "laereplan-prompt",
          "docs/demomanus.md",
        ),
        githubSide(
          { id: "laereplan-prompt-oeving", label: "Øving", group: LAEREPLAN_PROMPT },
          "laereplan-prompt",
          "docs/oeving.md",
        ),
        githubSide(
          { id: "laereplan-prompt-kostnad", label: "Kostnad", group: LAEREPLAN_PROMPT },
          "laereplan-prompt",
          "docs/kostnad.md",
        ),
      ],
    },
  },
];

export const DEFAULT_ENDPOINT_NAME = "Beta";

/** Antall rader per side i visningen. */
export const PAGE_SIZE = 1000;
