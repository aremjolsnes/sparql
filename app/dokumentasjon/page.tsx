import { isValidElement } from "react";
import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import KodeBlokk from "@/components/KodeBlokk";
import Mermaid from "@/components/Mermaid";
import { BUILTIN_ENDPOINTS, type DocPage } from "@/lib/endpoints";

/**
 * Viser dokumentasjonen for et endepunkt (Endpoint.docs) som en liten wiki: en sidemeny og én
 * Markdown-side om gangen. Åpnes fra ikonet i topplinjen når et endepunkt med dokumentasjon er valgt.
 * Sidene ligger i sine egne repoer og hentes fra main på GitHub. Appen tar vare på dem i høyst ett
 * minutt, og GitHub (raw.githubusercontent.com) i høyst fem (max-age=300), så endringer i repoene
 * vises innen omtrent fem minutter.
 */
export default async function DokumentasjonPage(props: PageProps<"/dokumentasjon">) {
  const { endepunkt, side } = await props.searchParams;
  const navn = typeof endepunkt === "string" ? endepunkt : "";
  const ep = BUILTIN_ENDPOINTS.find((e) => e.name === navn && e.docs);

  if (!ep?.docs) {
    return (
      <Ramme tittel="Dokumentasjon">
        <p className="text-sm text-muted">
          Fant ingen dokumentasjon for endepunktet «{navn || "–"}».
        </p>
      </Ramme>
    );
  }

  const docs = ep.docs;
  const sider = docs.pages;
  const adresse = (s: DocPage) =>
    `/dokumentasjon?endepunkt=${encodeURIComponent(ep.name)}` +
    (s === sider[0] ? "" : `&side=${encodeURIComponent(s.id)}`);

  const valgt = typeof side === "string" ? sider.find((s) => s.id === side) : sider[0];
  const meny = <Sidemeny sider={sider} valgt={valgt} adresse={adresse} />;
  if (!valgt) {
    return (
      <Ramme tittel={docs.title} meny={meny}>
        <p className="text-sm text-muted">Fant ingen side med navnet «{String(side)}».</p>
      </Ramme>
    );
  }

  let markdown: string | null = null;
  try {
    const res = await fetch(valgt.markdownUrl, { next: { revalidate: 60 } });
    if (res.ok) markdown = await res.text();
  } catch {
    markdown = null;
  }

  const components: Components = {
    // Lenker til en annen side i wikien (skrevet som GitHub-lenker i filen) blir lenker innenfor
    // wikien. Andre relative lenker (til filer i repoet) gjøres om til fulle GitHub-adresser.
    a: ({ href, children }) => {
      if (!href || href.startsWith("#")) {
        return (
          <a href={href} className="text-link hover:underline">
            {children}
          </a>
        );
      }
      const url = new URL(href, valgt.sourceUrl);
      const hash = url.hash;
      url.hash = "";
      const uten = url.toString().replace(/\/$/, "");
      const treff = sider.find((s) => s.sourceUrl === uten || s.aliases?.includes(uten));
      if (treff) {
        return (
          <Link href={adresse(treff) + hash} className="text-link hover:underline">
            {children}
          </Link>
        );
      }
      return (
        <a
          href={url.toString() + hash}
          className="text-link hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {children}
        </a>
      );
    },
    // Bilder med relativ adresse hentes fra repoet filen ligger i
    img: ({ src, alt }) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={typeof src === "string" ? new URL(src, valgt.markdownUrl).toString() : undefined}
        alt={alt ?? ""}
        className="max-w-full rounded border border-border"
      />
    ),
    h1: ({ children }) => <h1 className="text-xl font-semibold mt-2">{children}</h1>,
    h2: ({ children }) => (
      <h2
        id={anker(children)}
        className="text-lg font-semibold mt-8 pb-1 border-b border-border scroll-mt-4"
      >
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 id={anker(children)} className="text-base font-semibold mt-6 scroll-mt-4">
        {children}
      </h3>
    ),
    p: ({ children }) => <p className="leading-relaxed">{children}</p>,
    ul: ({ children }) => <ul className="list-disc pl-6 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-6 space-y-1">{children}</ol>,
    blockquote: ({ children }) => (
      <blockquote
        className="border-l-4 pl-3 py-1 text-muted"
        style={{ borderColor: "var(--accent)" }}
      >
        {children}
      </blockquote>
    ),
    pre: ({ children }) => {
      // ```mermaid-blokker tegnes som diagram
      if (
        isValidElement<{ className?: string; children?: React.ReactNode }>(children) &&
        children.props.className?.includes("language-mermaid")
      ) {
        return <Mermaid kode={tekst(children.props.children).trim()} />;
      }
      return <KodeBlokk>{children}</KodeBlokk>;
    },
    code: ({ className, children }) =>
      className ? (
        <code className={className}>{children}</code>
      ) : (
        <code className="font-mono text-[0.85em] rounded bg-panel-2 px-1 py-0.5">{children}</code>
      ),
    table: ({ children }) => (
      <div className="overflow-auto">
        <table className="text-xs border-collapse">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-border bg-panel-2 px-2 py-1 text-left font-semibold">
        {children}
      </th>
    ),
    td: ({ children }) => <td className="border border-border px-2 py-1 align-top">{children}</td>,
  };

  return (
    <Ramme tittel={docs.title} kilde={valgt.sourceUrl} meny={meny}>
      {markdown === null ? (
        <p className="text-sm text-muted">
          Klarte ikke å hente dokumentasjonen. Les den på{" "}
          <a href={valgt.sourceUrl} className="text-link hover:underline">
            GitHub
          </a>
          .
        </p>
      ) : (
        <article className="space-y-3 text-sm min-w-0">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {markdown}
          </ReactMarkdown>
        </article>
      )}
    </Ramme>
  );
}

/** Sidemenyen: sidene gruppert, med den valgte siden uthevet */
function Sidemeny({
  sider,
  valgt,
  adresse,
}: {
  sider: DocPage[];
  valgt?: DocPage;
  adresse: (s: DocPage) => string;
}) {
  const grupper = [...new Set(sider.map((s) => s.group))];
  const lenke = "block rounded px-2 py-1 border-l-2 ";
  const ikkeValgt = lenke + "border-transparent text-link hover:underline";
  return (
    <nav aria-label="Sider i dokumentasjonen" className="text-sm space-y-4">
      {grupper.map((gruppe) => (
        <div key={gruppe} className="space-y-1">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted">{gruppe}</div>
          <ul className="space-y-0.5">
            {sider
              .filter((s) => s.group === gruppe)
              .map((s) => (
                <li key={s.id}>
                  {s === valgt ? (
                    <Link
                      href={adresse(s)}
                      aria-current="page"
                      className={lenke + "bg-panel-2 text-foreground"}
                      style={{ borderColor: "var(--accent)" }}
                    >
                      {s.label}
                    </Link>
                  ) : (
                    <Link href={adresse(s)} className={ikkeValgt}>
                      {s.label}
                    </Link>
                  )}
                </li>
              ))}
          </ul>
        </div>
      ))}
      <div className="space-y-1">
        <div className="text-xs font-semibold uppercase tracking-wide text-muted">Workbench</div>
        <Link href="/hjelp" className={ikkeValgt}>
          Hjelp til editoren
        </Link>
      </div>
    </nav>
  );
}

/** All tekst i et React-tre, for eksempel innholdet i en overskrift */
function tekst(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(tekst).join("");
  if (isValidElement<{ children?: React.ReactNode }>(node)) return tekst(node.props.children);
  return "";
}

/** Anker for en overskrift, laget på samme måte som GitHub, så #-lenker i filene virker også her */
function anker(children: React.ReactNode): string {
  return tekst(children)
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "")
    .replace(/\s/g, "-");
}

function Ramme({
  tittel,
  kilde,
  meny,
  children,
}: {
  tittel: string;
  kilde?: string;
  meny?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className={`${meny ? "max-w-6xl" : "max-w-4xl"} mx-auto p-6 space-y-6 w-full`}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-muted">{tittel}</span>
        <div className="flex items-center gap-4 text-sm">
          {kilde && (
            <a
              href={kilde}
              className="text-link hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              Kilde
            </a>
          )}
          <Link href="/" className="text-link hover:underline">
            Til workbench
          </Link>
        </div>
      </div>
      {meny ? (
        <div className="grid gap-6 md:grid-cols-[13rem_minmax(0,1fr)] md:gap-8">
          <aside className="md:sticky md:top-6 md:self-start border border-border rounded bg-panel p-3">
            {meny}
          </aside>
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
