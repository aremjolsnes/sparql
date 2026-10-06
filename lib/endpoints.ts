export type Endpoint = {
  /** Visningsnavn i nedtrekksmenyen */
  name: string;
  /** Full URL til query-endepunktet */
  url: string;
  /** Innebygde endepunkter kan ikke fjernes i UI-et */
  builtin?: boolean;
  /**
   * Prefiks-overstyringer for dette endepunktet, for endepunkter som avviker fra
   * FIXED_PREFIXES. Ingen av de innebygde trenger det lenger: Beta har hatt
   * Prod-data (`data.udir.no` i status-URI-ene) siden Fuseki-byttet.
   */
  prefixes?: Record<string, string>;
};

/**
 * Innebygde endepunkter. Test/QA er utelatt med vilje – de er kun nåbare via Udir-VPN.
 * Beta kjører Jena Fuseki; Prod kjører GraphDB fram til Fuseki-byttet 9. november 2026.
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
];

export const DEFAULT_ENDPOINT_NAME = "Beta";

/** Antall rader per side i visningen. */
export const PAGE_SIZE = 1000;
