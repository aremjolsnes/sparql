-- SPARQL-workbench: OWL-kunnskap (idé 7, se Docs/ideer-ai-stotte.md)
-- Kuratert uttrekk (label + definisjon + domain/range) fra Docs/ontologi-lowercase.ttl,
-- importert via scripts/import-ontology.mjs. Statisk referansedata, ikke bruker-eid.
-- Kjøres i Supabase SQL-editor (eller via CLI).

-- uri er IKKE unik alene: noen få lokalnavn (f.eks. "status") brukes i
-- kildeontologien både som owl:ObjectProperty og som owl:Class, med hver sin
-- label/comment. Nøkkelen er derfor (uri, kind).
create table if not exists public.ontology_terms (
  uri         text not null,
  kind        text not null check (kind in ('class', 'object_property', 'datatype_property')),
  label_nb    text,
  label_en    text,
  comment_nb  text,
  comment_en  text,
  domain      text[] not null default '{}',
  range       text[] not null default '{}',
  updated_at  timestamptz not null default now(),
  primary key (uri, kind)
);

create index if not exists ontology_terms_kind_idx on public.ontology_terms (kind);

alter table public.ontology_terms enable row level security;

-- Åpen lesing – dette er ikke sensitiv eller bruker-spesifikk data, og appen
-- er åpen også for uinnloggede (jf. spesifikasjon.md).
drop policy if exists "public read ontology_terms" on public.ontology_terms;
create policy "public read ontology_terms" on public.ontology_terms
  for select using (true);

grant select on public.ontology_terms to anon, authenticated;

-- Ingen insert/update/delete-policy for anon/authenticated: kun import-scriptet
-- (kjører med SUPABASE_SECRET_KEY, forbigår RLS) skriver til denne tabellen.
