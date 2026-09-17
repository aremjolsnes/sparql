-- SPARQL-workbench: lagring for /test-verktøyet (GraphDB vs Jena Fuseki-sammenligning).
-- Erstatter Vercel Blob (krevde BLOB_READ_WRITE_TOKEN, som ikke er koblet til – Vercels
-- filsystem er skrivebeskyttet i produksjon). Ikke bruker-eid: verktøyet er åpent/uinnlogget,
-- og spørringer/rapporter er delt mellom alle som bruker det – samme mønster som
-- ontology_terms (003_ontology_terms.sql). Kjøres i Supabase SQL-editor (eller via CLI).

-- Brukerlagrede/overstyrte spørringer. De to spørringene som er commitet under queries/*.rq
-- i repoet regnes fortsatt som «innebygde» og leses fra filsystemet, uavhengig av denne
-- tabellen; denne tabellen dekker det brukeren selv lagrer eller overstyrer med, og kan
-- ikke slette et navn som bare finnes som innebygd (se lib/fuseki-test/store.ts).
create table if not exists public.fuseki_test_queries (
  name       text primary key,
  query      text not null,
  updated_at timestamptz not null default now()
);

alter table public.fuseki_test_queries enable row level security;

drop policy if exists "public read fuseki_test_queries" on public.fuseki_test_queries;
create policy "public read fuseki_test_queries" on public.fuseki_test_queries
  for select using (true);

grant select on public.fuseki_test_queries to anon, authenticated;

-- Ingen insert/update/delete-policy for anon/authenticated: kun
-- /api/test/queries-routen skriver, med SUPABASE_SECRET_KEY (forbigår RLS).

-- Batch-rapporter (én kjøring av alle lagrede spørringer mot begge endepunkter).
create table if not exists public.fuseki_test_reports (
  id         text primary key,
  created_at timestamptz not null default now(),
  data       jsonb not null
);

create index if not exists fuseki_test_reports_created_at_idx
  on public.fuseki_test_reports (created_at desc);

alter table public.fuseki_test_reports enable row level security;

drop policy if exists "public read fuseki_test_reports" on public.fuseki_test_reports;
create policy "public read fuseki_test_reports" on public.fuseki_test_reports
  for select using (true);

grant select on public.fuseki_test_reports to anon, authenticated;

-- Ingen insert/update/delete-policy for anon/authenticated: kun
-- /api/test/batch-routen skriver, med SUPABASE_SECRET_KEY (forbigår RLS).
