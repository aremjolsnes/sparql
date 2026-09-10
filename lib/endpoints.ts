export type Endpoint = {
  /** Visningsnavn i nedtrekksmenyen */
  name: string;
  /** Full URL til query-endepunktet */
  url: string;
  /** Innebygde endepunkter kan ikke fjernes i UI-et */
  builtin?: boolean;
};

/**
 * Innebygde endepunkter. Test/QA er utelatt med vilje – de er kun nåbare via Udir-VPN.
 */
export const BUILTIN_ENDPOINTS: Endpoint[] = [
  {
    name: "Fuseki Beta",
    url: "http://ca-sparql-beta.whitedune-e5bf55cb.norwayeast.azurecontainerapps.io/201906/query",
    builtin: true,
  },
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

export const DEFAULT_ENDPOINT_NAME = "Fuseki Beta";

/** Antall rader per side i visningen. */
export const PAGE_SIZE = 1000;
