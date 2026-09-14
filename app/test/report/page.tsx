import Link from "next/link";
import { listReportSummaries } from "@/lib/fuseki-test/store";

export const dynamic = "force-dynamic";

export default async function ReportListPage() {
  const reports = await listReportSummaries();
  return (
    <main>
      <p className="sub">
        <Link href="/test">← Tilbake til test</Link>
      </p>
      <h1>Batch-rapporter</h1>
      <p className="sub">
        Hver rapport er én kjøring av alle lagrede spørringer mot begge
        endepunkter.
      </p>

      {reports.length === 0 ? (
        <p>Ingen rapporter ennå. Kjør «Kjør alle lagrede» på forsiden.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Tidspunkt</th>
              <th>Spørringer</th>
              <th>Like</th>
              <th>Avvik</th>
              <th>Ikke sammenlignbar</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id}>
                <td>
                  <Link href={`/test/report/${r.id}`}>
                    {new Date(r.createdAt).toLocaleString("no-NO")}
                  </Link>
                </td>
                <td className="num">{r.count}</td>
                <td className="num">{r.equal}</td>
                <td className="num">{r.differing}</td>
                <td className="num">{r.incomparable}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
