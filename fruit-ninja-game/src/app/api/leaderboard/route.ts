import { NextResponse } from "next/server";

type Entry = { name: string; score: number; createdAt: string };

// Simple in-memory leaderboard (resets on server restart).
// Replace with a DB (Supabase/Mongo/etc.) for production.
const mem: { items: Entry[] } = (globalThis as any).__LEADERBOARD__ ?? { items: [] };
(globalThis as any).__LEADERBOARD__ = mem;

export async function GET() {
  const items = [...mem.items].sort((a, b) => b.score - a.score).slice(0, 10);
  return NextResponse.json({ items });
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as Partial<Entry> | null;
  const name = (body?.name ?? "Player").toString().slice(0, 24);
  const score = Number(body?.score ?? 0);
  const createdAt = new Date().toISOString();

  if (!Number.isFinite(score) || score < 0) {
    return NextResponse.json({ error: "Invalid score" }, { status: 400 });
  }

  mem.items.push({ name, score, createdAt });
  mem.items = mem.items.sort((a, b) => b.score - a.score).slice(0, 50);

  return NextResponse.json({ ok: true });
}

