import { NextResponse } from "next/server";
import { listReportSummaries } from "@/lib/fuseki-test/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await listReportSummaries());
}
