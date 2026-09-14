import { NextResponse } from "next/server";
import { getEndpoints } from "@/lib/fuseki-test/endpoints";

export const dynamic = "force-dynamic";

/** Exposes the resolved endpoint URLs so the UI can pre-fill the override fields. */
export async function GET() {
  return NextResponse.json(getEndpoints());
}
