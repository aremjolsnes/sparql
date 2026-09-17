import { BUILTIN_ENDPOINTS } from "@/lib/endpoints";
import { ensurePrefixes } from "@/lib/prefixes";

export const DEFAULT_PROD =
  "https://sparql-data.udir.no/repositories/201906";
export const DEFAULT_TEST =
  "https://ca-sparql-dev.yellowbeach-43b18c61.norwayeast.azurecontainerapps.io/201906/query";

export interface EndpointConfig {
  prod: string;
  test: string;
}

/**
 * Resolves the two SPARQL query URLs. Precedence:
 *   1. per-request override from the UI
 *   2. environment variable (PROD_SPARQL_URL / TEST_SPARQL_URL)
 *   3. hard-coded default above
 */
export function getEndpoints(
  override?: Partial<EndpointConfig> | null,
): EndpointConfig {
  return {
    prod:
      override?.prod?.trim() ||
      process.env.PROD_SPARQL_URL ||
      DEFAULT_PROD,
    test:
      override?.test?.trim() ||
      process.env.TEST_SPARQL_URL ||
      DEFAULT_TEST,
  };
}

/**
 * Prefiks-overstyringer for et gitt endepunkt, gjenkjent på URL mot
 * BUILTIN_ENDPOINTS (samme liste hovedsiden bruker). Kun Beta-repoet
 * (sparql-beta-data.udir.no) har `st:` i beta-data.udir.no – alle andre
 * kjente endepunkter (Prod, Fuseki Dev, Fuseki Beta) og ukjente/egendefinerte
 * URL-er bruker default (data.udir.no, se FIXED_PREFIXES).
 */
function prefixOverridesFor(url: string): Record<string, string> {
  const match = BUILTIN_ENDPOINTS.find((e) => e.url === url.trim());
  return match?.prefixes ?? {};
}

/**
 * Tilpasser en spørring til et gitt endepunkt: bytter ut en deklarert `st:`-
 * verdi som er en kjent variant (data.udir.no / beta-data.udir.no) med den
 * verdien endepunktet faktisk bruker. Se lib/prefixes.ts sin ensurePrefixes.
 */
export function adaptQueryForEndpoint(query: string, url: string): string {
  return ensurePrefixes(query, prefixOverridesFor(url)).query;
}
