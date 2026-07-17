import { NextResponse } from "next/server";
import { listGenres } from "@/lib/records";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ genres: await listGenres() });
}
