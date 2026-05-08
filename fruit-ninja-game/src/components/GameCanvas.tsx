"use client";

import * as React from "react";
import { gameConfig } from "@/constants/gameConfig";
import type { GameState } from "@/lib/gameEngine";
import type { Vec2 } from "@/lib/physics";

type Props = {
  state: GameState;
  onResize?: (size: { w: number; h: number }) => void;
  // Optional cursor (e.g. index finger tip) for debug/UX.
  cursor?: Vec2 | null;
};

export function GameCanvas({ state, cursor }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d", { alpha: false });
    if (!ctx) return;

    const w = gameConfig.canvas.width;
    const h = gameConfig.canvas.height;
    c.width = w;
    c.height = h;

    const draw = () => {
      // Background
      ctx.fillStyle = "#06121b";
      ctx.fillRect(0, 0, w, h);

      // Arena
      ctx.fillStyle = "#0b5f79";
      roundRect(ctx, 18, 18, w - 36, h - 36, 20);
      ctx.fill();

      // Fruits
      for (const f of state.fruits) {
        ctx.save();
        ctx.globalAlpha = f.sliced ? 0.55 : 1;
        ctx.fillStyle = fruitColor(f.kind);
        ctx.beginPath();
        ctx.arc(f.pos.x, f.pos.y, f.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Slash trails
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const s of state.slashes) {
        const age = (performance.now() - s.tMs) / 1000;
        const a = Math.max(0, 1 - age / gameConfig.slash.trailSeconds);
        ctx.globalAlpha = 0.35 * a;
        ctx.strokeStyle = "rgba(255,255,255,0.9)";
        ctx.lineWidth = 10 * a + 2;
        ctx.beginPath();
        ctx.moveTo(s.a.x, s.a.y);
        ctx.lineTo(s.b.x, s.b.y);
        ctx.stroke();
      }
      ctx.restore();

      // Cursor
      if (cursor) {
        ctx.save();
        ctx.fillStyle = "rgba(56,189,248,0.9)";
        ctx.beginPath();
        ctx.arc(cursor.x, cursor.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // Overlay text
      ctx.save();
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.font = "800 16px ui-sans-serif, system-ui";
      ctx.textAlign = "center";
      if (state.phase === "menu") ctx.fillText("Click Start → allow webcam → slash fruits", w / 2, h / 2);
      if (state.phase === "paused") ctx.fillText("Paused", w / 2, h / 2);
      if (state.phase === "gameOver") ctx.fillText("Game Over — Reset to play again", w / 2, h / 2);
      ctx.restore();
    };

    const raf = requestAnimationFrame(function tick() {
      draw();
      requestAnimationFrame(tick);
    });

    return () => cancelAnimationFrame(raf);
  }, [state, cursor]);

  return (
    <div className="panel p-0 overflow-hidden">
      <canvas ref={canvasRef} className="w-full h-auto aspect-[900/560] block" />
    </div>
  );
}

function fruitColor(kind: string) {
  switch (kind) {
    case "watermelon":
      return "#34d399";
    case "orange":
      return "#fb923c";
    case "lemon":
      return "#facc15";
    default:
      return "#fb7185";
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

