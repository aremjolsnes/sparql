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
