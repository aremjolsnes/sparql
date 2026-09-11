// Engangs-/reimport-script for idé 7 (Docs/ideer-ai-stotte.md): parser
// Docs/ontologi-lowercase.ttl og upserter et kuratert uttrekk (label,
// definisjon, domain/range) til Supabase-tabellen ontology_terms.
//
// Kjøres med: npm run import-ontology
// Krever NEXT_PUBLIC_SUPABASE_URL og SUPABASE_SECRET_KEY i .env.local.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { Parser } from "n3";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TTL_PATH = path.join(__dirname, "..", "Docs", "ontologi-lowercase.ttl");

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const RDFS_LABEL = "http://www.w3.org/2000/01/rdf-schema#label";
const RDFS_COMMENT = "http://www.w3.org/2000/01/rdf-schema#comment";
const RDFS_DOMAIN = "http://www.w3.org/2000/01/rdf-schema#domain";
const RDFS_RANGE = "http://www.w3.org/2000/01/rdf-schema#range";

const OWL_KIND = {
  "http://www.w3.org/2002/07/owl#Class": "class",
  "http://www.w3.org/2002/07/owl#ObjectProperty": "object_property",
  "http://www.w3.org/2002/07/owl#DatatypeProperty": "datatype_property",
};

function assignLangLiteral(slot, quad) {
  const lang = quad.object.language;
  const value = quad.object.value;
  if (lang === "nb" || lang === "no") slot.nb ??= value;
  else if (lang === "en") slot.en ??= value;
  else if (!slot.nb) slot.nb = value; // fallback for literals uten språktagg i kilden
  else slot.en ??= value;
}

/**
 * Filen er Protégé-generert med ett block per deklarasjon, hver innledet av
 * en "###  <uri>"-kommentarlinje. Samme URI kan ha flere block (f.eks.
 * "status" er både en owl:ObjectProperty og en owl:Class, med hver sin
 * label/comment) – derfor parses hvert block for seg i stedet for å gruppere
 * alle quads i fila på subjekt, som ville slått sammen/mistet disse.
 */
function splitBlocks(text) {
  const markerRe = /^###  \S+/m;
  const firstMarker = text.search(markerRe);
  const header = text.slice(0, firstMarker); // @prefix/@base-linjer
  const body = text.slice(firstMarker);

  const parts = body.split(/(?=^###  \S+)/m).filter((b) => b.trim());
  return { header, blocks: parts };
}

function main() {
  const ttl = readFileSync(TTL_PATH, "utf-8");
  const { header, blocks } = splitBlocks(ttl);
  const parser = new Parser();

  const terms = [];
  for (const block of blocks) {
    const quads = parser.parse(header + block);

    const typeQuad = quads.find(
      (q) => q.predicate.value === RDF_TYPE && OWL_KIND[q.object.value]
    );
    if (!typeQuad) continue; // ikke en klasse/property vi bryr oss om (f.eks. owl:Ontology, xsd:float)

    const uri = typeQuad.subject.value;
    const kind = OWL_KIND[typeQuad.object.value];
    const label = {};
    const comment = {};
    const domain = [];
    const range = [];

    for (const q of quads) {
      if (q.subject.value !== uri) continue;
      switch (q.predicate.value) {
        case RDFS_LABEL:
          assignLangLiteral(label, q);
          break;
        case RDFS_COMMENT:
          assignLangLiteral(comment, q);
          break;
        case RDFS_DOMAIN:
          domain.push(q.object.value);
          break;
        case RDFS_RANGE:
          range.push(q.object.value);
          break;
      }
    }

    terms.push({
      uri,
      kind,
      label_nb: label.nb ?? null,
      label_en: label.en ?? null,
      comment_nb: comment.nb ?? null,
      comment_en: comment.en ?? null,
      domain,
      range,
      updated_at: new Date().toISOString(),
    });
  }

  return terms;
}

async function upsert(terms) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL og/eller SUPABASE_SECRET_KEY mangler i miljøet (.env.local)."
    );
  }
  const supabase = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const chunkSize = 200;
  for (let i = 0; i < terms.length; i += chunkSize) {
    const chunk = terms.slice(i, i + chunkSize);
    const { error } = await supabase
      .from("ontology_terms")
      .upsert(chunk, { onConflict: "uri,kind" });
    if (error) throw new Error(`Supabase-feil ved upsert: ${error.message}`);
  }
}

const dryRun = process.argv.includes("--dry-run");

const terms = main();
const byKind = terms.reduce((acc, t) => {
  acc[t.kind] = (acc[t.kind] ?? 0) + 1;
  return acc;
}, {});
console.log(`Parset ${terms.length} termer fra ${path.basename(TTL_PATH)}:`, byKind);

if (dryRun) {
  console.log("--dry-run: hopper over Supabase-upsert. Eksempel:", terms[0]);
} else {
  await upsert(terms);
  console.log(`Upsertet ${terms.length} rader til ontology_terms.`);
}
