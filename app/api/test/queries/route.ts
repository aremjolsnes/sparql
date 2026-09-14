import { NextResponse } from "next/server";
import { deleteQuery, listQueries, saveQuery } from "@/lib/fuseki-test/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function writeError(e: unknown): NextResponse {
  const err = e as { code?: string; message?: string };
  if (err?.code === "EROFS" || err?.code === "EACCES") {
    return NextResponse.json(
      {
        error:
          "Lagring feilet: filsystemet er skrivebeskyttet. På Vercel må en Blob-store være koblet til (env-var BLOB_READ_WRITE_TOKEN); lokalt kjør npm run dev.",
      },
      { status: 501 },
    );
  }
  if (err?.code === "EBUILTIN") {
    return NextResponse.json({ error: err.message }, { status: 409 });
  }
  return NextResponse.json(
    { error: String(err?.message ?? e) },
    { status: 400 },
  );
}

export async function GET() {
  return NextResponse.json(await listQueries());
}

export async function POST(req: Request) {
  let body: { name?: unknown; query?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Ugyldig JSON." }, { status: 400 });
  }
  const name = typeof body.name === "string" ? body.name : "";
  const query = typeof body.query === "string" ? body.query.trim() : "";
  if (!name.trim() || !query) {
    return NextResponse.json(
      { error: "Både navn og spørring må fylles ut." },
      { status: 400 },
    );
  }
  try {
    return NextResponse.json(await saveQuery(name, query));
  } catch (e) {
    return writeError(e);
  }
}

export async function DELETE(req: Request) {
  const name = new URL(req.url).searchParams.get("name") ?? "";
  if (!name.trim()) {
    return NextResponse.json({ error: "Mangler ?name=" }, { status: 400 });
  }
  try {
    await deleteQuery(name);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return writeError(e);
  }
}
