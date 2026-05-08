"use client";

import * as React from "react";
import { gameConfig } from "@/constants/gameConfig";
import type { GameState } from "@/lib/gameEngine";
import type { Vec2 } from "@/lib/physics";

type Props = {
  state: GameState;
  // videoRef from useWebcam — the webcam stream is attached here
  videoRef: React.RefObject<HTMLVideoElement | null>;
  cursor?: Vec2 | null;
};

export function GameCanvas({ state, videoRef, cursor }: Props) {
  const canvasRef = React.useRef<HTMLCanvasElement | null>(null);

  // Keep latest state/cursor in refs so the RAF loop doesn't need to restart.
  const stateRef = React.useRef(state);
  const cursorRef = React.useRef(cursor);
  React.useEffect(() => { stateRef.current = state; }, [state]);
  React.useEffect(() => { cursorRef.current = cursor; }, [cursor]);

  // Single-mounted RAF draw loop. Reads from refs each frame.
  React.useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    // alpha:true so the canvas is transparent and the video shows through.
    const ctx = c.getContext("2d", { alpha: true });
    if (!ctx) return;

    c.width = gameConfig.canvas.width;
    c.height = gameConfig.canvas.height;
    const w = c.width;
    const h = c.height;

    let rafId = 0;

    const draw = () => {
      const s = stateRef.current;
      const cur = cursorRef.current;

      ctx.clearRect(0, 0, w, h);

      // Dark translucent tint so bright webcam doesn't wash out fruits
      ctx.fillStyle = "rgba(0,0,0,0.38)";
      ctx.fillRect(0, 0, w, h);

      // --- Fruits ---
      for (const f of s.fruits) {
        if (!f.sliced) {
          ctx.save();
          ctx.globalAlpha = 1;
          ctx.shadowColor = fruitColor(f.kind);
          ctx.shadowBlur = 20;
          ctx.fillStyle = fruitColor(f.kind);
          ctx.beginPath();
          ctx.arc(f.pos.x, f.pos.y, f.radius, 0, Math.PI * 2);
          ctx.fill();
          // Shine highlight
          ctx.shadowBlur = 0;
          ctx.globalAlpha *= 0.38;
          ctx.fillStyle = "#fff";
          ctx.beginPath();
          ctx.arc(f.pos.x - f.radius * 0.28, f.pos.y - f.radius * 0.32, f.radius * 0.36, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
          continue;
        }

        drawSlicedHalf(ctx, f, -1);
        drawSlicedHalf(ctx, f, 1);
      }

      // --- Slash trails ---
      ctx.save();
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      for (const sl of s.slashes) {
        const age = (performance.now() - sl.tMs) / 1000;
        const a = Math.max(0, 1 - age / gameConfig.slash.trailSeconds);
        ctx.globalAlpha = 0.75 * a;
        ctx.lineWidth = 14 * a + 3;
        ctx.strokeStyle = "rgba(255,255,255,0.95)";
        ctx.shadowColor = "rgba(100,200,255,0.9)";
        ctx.shadowBlur = 22 * a;
        ctx.beginPath();
        ctx.moveTo(sl.a.x, sl.a.y);
        ctx.lineTo(sl.b.x, sl.b.y);
        ctx.stroke();
      }
      ctx.restore();

      // --- Finger cursor ring ---
      if (cur) {
        ctx.save();
        // Outer glow ring
        ctx.shadowColor = "rgba(56,189,248,0.95)";
        ctx.shadowBlur = 22;
        ctx.strokeStyle = "rgba(255,255,255,0.92)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, 28, 0, Math.PI * 2);
        ctx.stroke();
        // Second inner ring
        ctx.globalAlpha = 0.6;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, 16, 0, Math.PI * 2);
        ctx.stroke();
        // Center dot
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(56,189,248,0.88)";
        ctx.shadowBlur = 10;
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // --- Phase overlay ---
      drawPhaseOverlay(ctx, s.phase, w, h);

      rafId = requestAnimationFrame(draw);
    };

    rafId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafId);
  }, []); // intentionally empty — reads state/cursor via refs

  return (
    <div
      className="relative w-full overflow-hidden rounded-2xl border border-white/12 shadow-2xl bg-black"
      style={{ aspectRatio: "900/560" }}
    >
      {/* Webcam video — fills the full container, horizontally mirrored */}
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover [transform:scaleX(-1)]"
        playsInline
        muted
        autoPlay
      />
      {/* Transparent game canvas sits on top */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
    </div>
  );
}

function drawPhaseOverlay(ctx: CanvasRenderingContext2D, phase: string, w: number, h: number) {
  if (phase === "playing") return;
  const messages: Record<string, [string, string]> = {
    menu:     ["rgba(255,255,255,0.94)", "Enable Webcam → Load Model → Start"],
    paused:   ["rgba(255,255,255,0.94)", "Paused"],
    gameOver: ["rgba(255,84,112,0.96)",  "Game Over — Reset to play again"],
  };
  const [color, text] = messages[phase] ?? ["rgba(255,255,255,0.94)", ""];
  if (!text) return;

  ctx.save();
  ctx.font = "800 18px ui-sans-serif, system-ui";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const tw = ctx.measureText(text).width;
  const boxW = tw + 56;
  const boxH = 50;
  const bx = (w - boxW) / 2;
  const by = h / 2 - boxH / 2;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  roundRect(ctx, bx, by, boxW, boxH, 14);
  ctx.fill();

  ctx.fillStyle = color;
  ctx.fillText(text, w / 2, h / 2);
  ctx.restore();
}

function fruitColor(kind: string) {
  switch (kind) {
    case "watermelon": return "#34d399";
    case "orange":     return "#fb923c";
    case "lemon":      return "#facc15";
    default:           return "#fb7185";
  }
}

function drawSlicedHalf(
  ctx: CanvasRenderingContext2D,
  fruit: {
    kind: string;
    pos: Vec2;
    radius: number;
    splitNormal: Vec2;
    splitOffset: number;
    rotation: number;
  },
  side: -1 | 1,
) {
  const baseAngle = Math.atan2(fruit.splitNormal.y, fruit.splitNormal.x);
  const x = fruit.pos.x + fruit.splitNormal.x * fruit.splitOffset * side;
  const y = fruit.pos.y + fruit.splitNormal.y * fruit.splitOffset * side;
  const r = fruit.radius;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(baseAngle + fruit.rotation * side);

  ctx.shadowColor = fruitColor(fruit.kind);
  ctx.shadowBlur = 16;
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = fruitColor(fruit.kind);

  ctx.beginPath();
  if (side > 0) {
    ctx.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
  } else {
    ctx.arc(0, 0, r, Math.PI / 2, (3 * Math.PI) / 2);
  }
  ctx.closePath();
  ctx.fill();

  // Light inner flesh line along the cut edge.
  ctx.shadowBlur = 0;
  ctx.strokeStyle = "rgba(255,255,255,0.75)";
  ctx.lineWidth = Math.max(2, r * 0.1);
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.85);
  ctx.lineTo(0, r * 0.85);
  ctx.stroke();

  ctx.restore();
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
