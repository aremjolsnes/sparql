import Link from "next/link";
import { notFound } from "next/navigation";
import { getReport } from "@/lib/fuseki-test/store";
import type { BatchItem } from "@/lib/fuseki-test/types";

export const dynamic = "force-dynamic";

function ms(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "–";
  return n >= 1000 ? `${(n / 1000).toFixed(2)} s` : `${n.toFixed(0)} ms`;
}

function ratio(item: BatchItem): string {
  const p = item.prodMedianMs;
  const t = item.testMedianMs;
  if (!p || !t) return "–";
  const r = t / p;
  return `${r.toFixed(2)}×`;
}

function statusCell(item: BatchItem): { cls: string; text: string } {
  if (item.error) return { cls: "bad", text: "feilet" };
  if (!item.diffComparable) return { cls: "warn", text: item.diffSummary };
  if (item.diffEqual) return { cls: "ok", text: "like" };
  return { cls: "bad", text: item.diffSummary };
}

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) notFound();

  const equal = report.items.filter(
    (i) => i.diffComparable && i.diffEqual,
  ).length;

  return (
    <main>
      <p className="sub">
        <Link href="/test/report">← Alle rapporter</Link>
        {"  ·  "}
        <Link href="/test">Ny test</Link>
      </p>
      <h1>Batch-rapport</h1>
      <p className="sub">
        {new Date(report.createdAt).toLocaleString("no-NO")} ·{" "}
        {report.items.length} spørringer · {equal} like ·{" "}
        {report.params.iterations} iterasjoner, {report.params.warmup} warmup
        {report.params.concurrency > 1
          ? `, samtidighet ${report.params.concurrency}`
          : ""}
      </p>
      <p className="sub" style={{ marginTop: "-0.75rem" }}>
        <code>dagens</code> {report.endpoints.prod}
        <br />
        <code>test</code> {report.endpoints.test}
      </p>

      <table>
        <thead>
          <tr>
            <th>Spørring</th>
            <th>Status</th>
            <th>Dagens median</th>
            <th>Test median</th>
            <th>test/dagens</th>
            <th>Kaldstart test</th>
            <th>Rader d/t</th>
          </tr>
        </thead>
        <tbody>
          {report.items.map((item) => {
            const s = statusCell(item);
            return (
              <tr key={item.name}>
                <td>{item.name}</td>
                <td>
                  <span className={`banner ${s.cls}`} style={inlineBadge}>
                    {s.text}
                  </span>
                  {item.error ? (
                    <div style={{ color: "var(--muted)" }}>{item.error}</div>
                  ) : null}
                </td>
                <td className="num">{ms(item.prodMedianMs)}</td>
                <td className="num">{ms(item.testMedianMs)}</td>
                <td className="num">{ratio(item)}</td>
                <td className="num">{ms(item.testColdMs)}</td>
                <td className="num">
                  {item.prodRows ?? "–"} / {item.testRows ?? "–"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </main>
  );
}

const inlineBadge: React.CSSProperties = {
  display: "inline-block",
  margin: 0,
  padding: "0.1rem 0.5rem",
  fontSize: "0.8rem",
};
