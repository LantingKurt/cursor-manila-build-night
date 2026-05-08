"use client";

import type { GameState } from "@/lib/gameEngine";

export function Stats({ state }: { state: GameState }) {
  const phaseLabel =
    state.phase === "menu"
      ? "Menu"
      : state.phase === "playing"
        ? "Playing"
        : state.phase === "paused"
          ? "Paused"
          : "Game Over";

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="panel">
        <div className="panel-label">Score</div>
        <div className="panel-value">{state.score}</div>
      </div>
      <div className="panel">
        <div className="panel-label">Lives</div>
        <div className="panel-value">{state.lives}</div>
      </div>
      <div className="panel">
        <div className="panel-label">Combo</div>
        <div className="panel-value">{state.combo}</div>
      </div>
      <div className="panel">
        <div className="panel-label">State</div>
        <div className="panel-value text-sky-300">{phaseLabel}</div>
      </div>
    </div>
  );
}

