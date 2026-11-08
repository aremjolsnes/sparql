import Link from "next/link";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { BUILTIN_ENDPOINTS } from "@/lib/endpoints";

/**
 * Viser brukerdokumentasjonen for et endepunkt (Endpoint.docs), hentet som Markdown.
 * Åpnes fra ikonet i topplinjen når et endepunkt med dokumentasjon er valgt.
 * Filen hentes på nytt etter høyst ti minutter, så endringer i repoet slår raskt gjennom.
 */
export default async function DokumentasjonPage(props: PageProps<"/dokumentasjon">) {
  const { endepunkt } = await props.searchParams;
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
  let markdown: string | null = null;
  try {
    const res = await fetch(docs.markdownUrl, { next: { revalidate: 600 } });
    if (res.ok) markdown = await res.text();
  } catch {
    markdown = null;
  }

  // Relative lenker i filen (til andre filer i repoet) gjøres om til fulle GitHub-adresser
  const components: Components = {
    a: ({ href, children }) => {
      const ekstern = !!href && !href.startsWith("#");
      const full = ekstern ? new URL(href, docs.sourceUrl).toString() : href;
      return (
        <a
          href={full}
          className="text-link hover:underline"
          {...(ekstern ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        >
          {children}
        </a>
      );
    },
    h1: ({ children }) => <h1 className="text-xl font-semibold mt-2">{children}</h1>,
    h2: ({ children }) => (
      <h2 className="text-lg font-semibold mt-8 pb-1 border-b border-border">{children}</h2>
    ),
    h3: ({ children }) => <h3 className="text-base font-semibold mt-6">{children}</h3>,
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
    pre: ({ children }) => (
      <pre className="text-xs font-mono rounded border border-border bg-panel-2 p-3 overflow-auto">
        {children}
      </pre>
    ),
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
    <Ramme tittel={docs.title} kilde={docs.sourceUrl}>
      {markdown === null ? (
        <p className="text-sm text-muted">
          Klarte ikke å hente dokumentasjonen. Les den på{" "}
          <a href={docs.sourceUrl} className="text-link hover:underline">
            GitHub
          </a>
          .
        </p>
      ) : (
        <article className="space-y-3 text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
            {markdown}
          </ReactMarkdown>
        </article>
      )}
    </Ramme>
  );
}

function Ramme({
  tittel,
  kilde,
  children,
}: {
  tittel: string;
  kilde?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 w-full">
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
      {children}
    </div>
  );
}
