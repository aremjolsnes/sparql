"use client";

import { getSupabase, supabaseConfigured } from "@/lib/supabase/client";

export type OntologyTermKind = "class" | "object_property" | "datatype_property";

export type OntologyTerm = {
  uri: string;
  kind: OntologyTermKind;
  labelNb: string | null;
  labelEn: string | null;
  commentNb: string | null;
  commentEn: string | null;
  domain: string[];
  range: string[];
};

let cache: Promise<OntologyTerm[]> | null = null;

/**
 * Henter OWL-kunnskapen (idé 7, se Docs/ideer-ai-stotte.md) fra Supabase –
 * statisk referansedata, kun lest, brukt til fullføringshjelp (idé 1).
 * Hentes én gang og caches for resten av sesjonen. Returnerer [] (i stedet
 * for å kaste) hvis Supabase ikke er konfigurert eller kallet feiler, slik
 * at fullføring bare stille uteblir.
 */
export function fetchOntologyTerms(): Promise<OntologyTerm[]> {
  if (!cache) cache = loadOntologyTerms();
  return cache;
}

async function loadOntologyTerms(): Promise<OntologyTerm[]> {
  if (!supabaseConfigured()) return [];
  try {
    const { data, error } = await getSupabase()
      .from("ontology_terms")
      .select("uri,kind,label_nb,label_en,comment_nb,comment_en,domain,range");
    if (error || !data) return [];
    return data.map((row) => ({
      uri: row.uri as string,
      kind: row.kind as OntologyTermKind,
      labelNb: (row.label_nb as string | null) ?? null,
      labelEn: (row.label_en as string | null) ?? null,
      commentNb: (row.comment_nb as string | null) ?? null,
      commentEn: (row.comment_en as string | null) ?? null,
      domain: (row.domain as string[] | null) ?? [],
      range: (row.range as string[] | null) ?? [],
    }));
  } catch {
    return [];
  }
}
