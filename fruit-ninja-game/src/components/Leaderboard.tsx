"use client";

import * as React from "react";

export type LeaderboardEntry = {
  name: string;
  score: number;
  createdAt: string;
};

export function Leaderboard({ enabled }: { enabled: boolean }) {
  const [items, setItems] = React.useState<LeaderboardEntry[]>([]);
  const [status, setStatus] = React.useState<"idle" | "loading" | "error">("idle");

  React.useEffect(() => {
    if (!enabled) return;
    let alive = true;
    setStatus("loading");
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        setItems((data?.items as LeaderboardEntry[]) ?? []);
        setStatus("idle");
      })
      .catch(() => {
        if (!alive) return;
        setStatus("error");
      });
    return () => {
      alive = false;
    };
  }, [enabled]);

  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-extrabold tracking-tight">Leaderboard</div>
        {!enabled && <div className="text-xs text-white/50">disabled</div>}
      </div>
      {enabled && status === "loading" && <div className="mt-2 text-sm text-white/70">Loading…</div>}
      {enabled && status === "error" && (
        <div className="mt-2 text-sm text-rose-300">API unavailable (localStorage fallback recommended).</div>
      )}
      {enabled && status === "idle" && (
        <ol className="mt-2 space-y-1 text-sm">
          {items.length === 0 && <div className="text-white/60">No scores yet.</div>}
          {items.map((it, idx) => (
            <li key={`${it.createdAt}_${idx}`} className="flex items-center justify-between gap-2">
              <span className="truncate text-white/80">
                {idx + 1}. {it.name}
              </span>
              <span className="font-bold text-white">{it.score}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

