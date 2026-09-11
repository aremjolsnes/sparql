import Link from "next/link";

function Example({
  before,
  after,
  note,
}: {
  before: string;
  after: string;
  note?: string;
}) {
  return (
    <div className="space-y-1.5">
      <pre className="text-xs font-mono whitespace-pre-wrap rounded border border-border bg-panel-2 p-3 overflow-auto">
        {before}
      </pre>
      <pre className="text-xs font-mono whitespace-pre-wrap rounded border border-border bg-panel-2 p-3 overflow-auto">
        {after}
      </pre>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3 border border-border rounded bg-panel p-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="space-y-3 text-sm">{children}</div>
    </section>
  );
}

export default function HjelpPage() {
  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Hjelp: verktøystøtte i editoren</h1>
        <Link href="/" className="text-link hover:underline text-sm">
          Til workbench
        </Link>
      </div>

      <p className="text-sm text-muted">
        Editoren har tre former for skrivehjelp, alle fremkalt med <b>Ctrl+Space</b> (eller
        automatisk dropdown mens du skriver, for de to første). Bakgrunn og utviklingshistorikk
        står i{" "}
        <a
          href="https://github.com/aremjolsnes/sparql/blob/main/Docs/ideer-ai-stotte.md"
          className="text-link hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Docs/ideer-ai-stotte.md
        </a>
        .
      </p>

      <Section title="1. u:-fullføring">
        <p>
          Skriv <code className="font-mono">u:</code> hvor som helst i en trippel, så foreslår
          editoren klasser (rett etter <code className="font-mono">a</code>) eller properties
          (ellers) fra Grep-ontologien. Forslagene innsnevres automatisk til properties som
          faktisk passer typen du allerede har deklarert i samme blokk.
        </p>
        <Example
          before={"?s a u:fagk"}
          after={"?s a u:fagkode"}
          note="Rett etter “a”: kun klasser foreslås."
        />
        <Example
          before={"?s a u:fagkode ;\n   u:ko"}
          after={"?s a u:fagkode ;\n   u:kode"}
          note="Ellers: properties, innsnevret til dem med domain som matcher u:fagkode."
        />
      </Section>

      <Section title="2. Gyldighet-mønster-snippet">
        <p>
          For koblinger som selv har en gyldighetsperiode (bNode-mønsteret beskrevet i{" "}
          <a
            href="https://github.com/Utdanningsdirektoratet/Grep_SPARQL/wiki/Blanke-noder-for-gyldighetsinformasjon-i-referanseobjekter"
            className="text-link hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            Grepwiki
          </a>
          ): skriv <code className="font-mono">u:</code> i property-posisjon og velg
          «gyldighet-mønster» fra dropdownen. Setter inn hele sjekken (bNode, regex mot kode,
          nullpunkt-/evighetsdatoer for delvis manglende gyldighet) med tab-stopp for kode og
          dato.
        </p>
        <p className="text-muted text-xs">
          Husk en eksplisitt kolonneliste i SELECT (ikke <code className="font-mono">*</code>) og
          utelat <code className="font-mono">?bnode</code> – ellers kan flere blanke noder med
          samme innhold gi tilsynelatende duplikate rader.
        </p>
      </Section>

      <Section title="3. #+ regex: / #+ filter: (AI-hjelp)">
        <p>
          Skriv en kommentarlinje som beskriver hva du vil matche/filtrere på, med{" "}
          <code className="font-mono">#+ regex:</code> eller{" "}
          <code className="font-mono">#+ filter:</code> foran beskrivelsen. Cursor på linja,
          trykk <b>Ctrl+Space</b>, vent på forslaget (nettverkskall, tar noen sekunder), og trykk{" "}
          <b>Enter</b> for å sette det inn i stedet for kommentarlinja.
        </p>
        <p>
          <code className="font-mono">#+ filter:</code> gir alltid en komplett{" "}
          <code className="font-mono">FILTER(...)</code>-linje.{" "}
          <code className="font-mono">#+ regex:</code> gir som standard et bart{" "}
          <code className="font-mono">regex(...)</code>-uttrykk du kombinerer selv – men følger
          beskrivelsen hvis den selv sier hva resultatet skal brukes til.
        </p>

        <Example
          before={
            "?s a u:fagkode ;\n   u:kode ?kode .\n#+ filter: kode starter på NOR eller ENG"
          }
          after={'FILTER (regex(str(?kode), "^(NOR|ENG)", "i"))'}
        />

        <Example
          before={
            "?s a u:fagkode ;\n   u:kode ?kode .\n#+ regex: kode starter på NOR eller ENG, uavhengig av store/små bokstaver"
          }
          after={'regex(str(?kode), "^(NOR|ENG)", "i")'}
          note="Bart uttrykk – sett selv inn i en FILTER(...) eller kombinér med && / || / !."
        />

        <Example
          before={
            "?s a u:fagkode ;\n   u:kode ?kode .\n#+ regex: bind sant/usant til variabelen ?erNordisk avhengig av om kode starter på NOR eller ENG, behold alle rader også de som ikke matcher"
          }
          after={'BIND(IF(regex(str(?kode), "^(NOR|ENG)"), true, false) AS ?erNordisk)'}
          note="Legitim “bind ... til”-bruk: alltid bundet (true/false), alle rader beholdes."
        />

        <div className="rounded border p-3 text-xs" style={{ borderColor: "var(--accent)" }}>
          <b>Fallgruve:</b> be aldri om å “binde” noe til en variabel når du egentlig vil{" "}
          <i>ekskludere</i> rader som ikke matcher – det gir en betinget binding som lar
          ikke-matchende rader stå med variabelen ubundet («–» i tabellen), ikke filtrert bort.{" "}
          <code className="font-mono">SELECT DISTINCT</code> hjelper ikke her, siden alle de
          ubundne radene kollapser til én ekstra «–»-rad i tillegg til de ekte treffene. Skriv
          «filtrer på …» når du vil ekskludere rader; reserver «bind … til» for når du faktisk
          vil beholde alle radene og legge på en utledet verdi.
        </div>
      </Section>
    </div>
  );
}
