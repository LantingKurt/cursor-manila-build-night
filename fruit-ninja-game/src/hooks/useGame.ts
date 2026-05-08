import * as React from "react";
import { gameConfig } from "@/constants/gameConfig";
import { createInitialState, setPaused, startGame, stepGame, type GameState } from "@/lib/gameEngine";
import type { Vec2 } from "@/lib/physics";

export function useGame() {
  const [state, setState] = React.useState<GameState>(() => createInitialState(performance.now()));

  const start = React.useCallback(() => {
    setState((s) => startGame(s, performance.now()));
  }, []);

  const pause = React.useCallback(() => {
    setState((s) => setPaused(s, true));
  }, []);

  const resume = React.useCallback(() => {
    setState((s) => setPaused(s, false));
  }, []);

  const reset = React.useCallback(() => {
    setState(() => createInitialState(performance.now()));
  }, []);

  const submitSlash = React.useCallback((a: Vec2, b: Vec2, tMs: number) => {
    setState((s) =>
      stepGame(s, {
        nowMs: tMs,
        dt: 0,
        canvas: { w: gameConfig.canvas.width, h: gameConfig.canvas.height },
        slash: { a, b, tMs },
      }),
    );
  }, []);

  React.useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.033, Math.max(0, (t - last) / 1000));
      last = t;
      setState((s) =>
        stepGame(s, {
          nowMs: t,
          dt,
          canvas: { w: gameConfig.canvas.width, h: gameConfig.canvas.height },
          slash: null,
        }),
      );
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return { state, start, pause, resume, reset, submitSlash };
}

