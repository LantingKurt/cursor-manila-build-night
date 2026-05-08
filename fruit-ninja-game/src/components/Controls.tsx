"use client";

import * as React from "react";
import type { GamePhase } from "@/lib/gameEngine";

export function Controls({
  phase,
  onStart,
  onPause,
  onResume,
  onReset,
}: {
  phase: GamePhase;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {phase === "menu" && (
        <button className="btn btn-primary" onClick={onStart}>
          Start
        </button>
      )}
      {phase === "playing" && (
        <button className="btn" onClick={onPause}>
          Pause
        </button>
      )}
      {phase === "paused" && (
        <button className="btn" onClick={onResume}>
          Resume
        </button>
      )}
      <button className="btn" onClick={onReset}>
        Reset
      </button>
    </div>
  );
}

