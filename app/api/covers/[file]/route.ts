import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { coverPath } from "@/lib/covers";

const SAFE_NAME = /^[0-9]+-[0-9a-f]+\.(jpg|png)$/;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  const { file } = await params;
  if (!SAFE_NAME.test(file)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  try {
    const buf = await readFile(coverPath(file));
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": file.endsWith(".png") ? "image/png" : "image/jpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
}
