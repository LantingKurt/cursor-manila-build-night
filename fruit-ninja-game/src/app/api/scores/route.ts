import { NextResponse } from "next/server";

// Alias endpoint for compatibility with prompt.
export async function GET() {
  const r = await fetchLeaderboard();
  return r;
}

export async function POST(req: Request) {
  const r = await postLeaderboard(req);
  return r;
}

async function fetchLeaderboard() {
  // Internally delegate to /api/leaderboard without doing an extra network hop.
  const mem: { items: any[] } = (globalThis as any).__LEADERBOARD__ ?? { items: [] };
  (globalThis as any).__LEADERBOARD__ = mem;
  const items = [...mem.items].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 10);
  return NextResponse.json({ items });
}

async function postLeaderboard(req: Request) {
  const body = (await req.json().catch(() => null)) as { name?: unknown; score?: unknown } | null;
  const name = (body?.name ?? "Player").toString().slice(0, 24);
  const score = Number(body?.score ?? 0);
  const createdAt = new Date().toISOString();
  if (!Number.isFinite(score) || score < 0) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }

  const mem: { items: Array<{ name: string; score: number; createdAt: string }> } =
    (globalThis as any).__LEADERBOARD__ ?? { items: [] };
  (globalThis as any).__LEADERBOARD__ = mem;
  mem.items.push({ name, score, createdAt });
  mem.items = mem.items.sort((a, b) => b.score - a.score).slice(0, 50);
  return NextResponse.json({ ok: true });
}

