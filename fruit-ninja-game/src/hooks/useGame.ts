import * as React from "react";
import { gameConfig } from "@/constants/gameConfig";
import { createInitialState, setPaused, startGame, stepGame, type GameState } from "@/lib/gameEngine";
import type { Vec2 } from "@/lib/physics";

export function useGame() {
  const [state, setState] = React.useState<GameState>(() => createInitialState(performance.now()));
  const debugRef = React.useRef({ mounts: 0, ticks: 0 });

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
    // #region agent log
    debugRef.current.mounts += 1;
    fetch("http://127.0.0.1:7723/ingest/c9380e78-3eea-49c4-9a01-43685a1d3819", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e738c9" },
      body: JSON.stringify({
        sessionId: "e738c9",
        runId: "pre-fix",
        hypothesisId: "H3",
        location: "src/hooks/useGame.ts:useEffect",
        message: "RAF effect mounted",
        data: { mounts: debugRef.current.mounts },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log

    let raf = 0;
    let last = performance.now();

    const tick = (t: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.033, Math.max(0, (t - last) / 1000));
      last = t;
      // #region agent log
      debugRef.current.ticks += 1;
      if (debugRef.current.ticks <= 3) {
        fetch("http://127.0.0.1:7723/ingest/c9380e78-3eea-49c4-9a01-43685a1d3819", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e738c9" },
          body: JSON.stringify({
            sessionId: "e738c9",
            runId: "pre-fix",
            hypothesisId: "H3",
            location: "src/hooks/useGame.ts:tick",
            message: "tick -> setState(stepGame)",
            data: { ticks: debugRef.current.ticks, dt },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
      // #endregion agent log
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
    return () => {
      // #region agent log
      fetch("http://127.0.0.1:7723/ingest/c9380e78-3eea-49c4-9a01-43685a1d3819", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e738c9" },
        body: JSON.stringify({
          sessionId: "e738c9",
          runId: "pre-fix",
          hypothesisId: "H3",
          location: "src/hooks/useGame.ts:cleanup",
          message: "RAF effect cleanup",
          data: { ticks: debugRef.current.ticks },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log
      cancelAnimationFrame(raf);
    };
  }, []);

  return { state, start, pause, resume, reset, submitSlash };
}

