import { NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs/promises";

export async function POST(req: Request) {
  const body = await req.text();
  const filePath = path.join(process.cwd(), "..", "debug-e738c9.log");
  try {
    // Ensure NDJSON newline.
    const line = body.endsWith("\n") ? body : body + "\n";
    await fs.appendFile(filePath, line, "utf8");
  } catch {
    // Swallow errors; this endpoint is only for debug instrumentation.
  }
  return NextResponse.json({ ok: true });
}

