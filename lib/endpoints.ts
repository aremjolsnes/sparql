import { SANDBOX_PREFIXES } from "@/lib/prefixes";

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
   * Sandkassen bruker det til sine egne navnerom (udir:, owl:, skos:, dcterms:, schema:, text:, styrk:, isco:, dcat:, void:).
   */
  prefixes?: Record<string, string>;
  /**
   * Brukerdokumentasjon for endepunktet. Når den finnes, vises et ikon i topplinjen som åpner
   * /dokumentasjon?endepunkt=<name>, der Markdown-filen hentes og vises.
   */
  docs?: {
    /** Overskrift på dokumentasjonssiden */
    title: string;
    /** Rå Markdown-fil som hentes og vises */
    markdownUrl: string;
    /** Siden der filen ligger (GitHub), for lenken «Kilde» og for relative lenker i filen */
    sourceUrl: string;
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
      title: "Sandkassen: Brukerveiledning",
      markdownUrl:
        "https://raw.githubusercontent.com/aremjolsnes/grep-jena-fuseki/refs/heads/main/docs/bruk.md",
      sourceUrl: "https://github.com/aremjolsnes/grep-jena-fuseki/blob/main/docs/bruk.md",
    },
  },
];

export const DEFAULT_ENDPOINT_NAME = "Beta";

/** Antall rader per side i visningen. */
export const PAGE_SIZE = 1000;
