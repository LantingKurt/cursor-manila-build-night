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
  const spritesRef = React.useRef(createSpriteCache());

  // Keep latest state/cursor in refs so the RAF loop doesn't need to restart.
  const stateRef = React.useRef(state);
  const cursorRef = React.useRef(cursor);
  const cursorTrailRef = React.useRef<Array<{ x: number; y: number; t: number }>>([]);
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
        const sprite = spriteForFruitKind(f.kind);
        if (!f.sliced) {
          const wholeImage = spritesRef.current[sprite.whole];
          if (wholeImage.complete && wholeImage.naturalWidth > 0) {
            drawImageCentered(ctx, wholeImage, f.pos.x, f.pos.y, f.radius * 2.6, f.radius * 2.6, 0, 1);
          } else {
            drawFallbackFruit(ctx, f.kind, f.pos.x, f.pos.y, f.radius);
          }
          continue;
        }

        const partA = spritesRef.current[sprite.part1];
        const partB = spritesRef.current[sprite.part2];
        drawSlicedHalf(ctx, f, -1, partA);
        drawSlicedHalf(ctx, f, 1, partB);
      }

      // --- Slash trails ---
      ctx.save();
      for (const sl of s.slashes) {
        const age = (performance.now() - sl.tMs) / 1000;
        const a = Math.max(0, 1 - age / gameConfig.slash.trailSeconds);
        drawNeonDottedSegment(ctx, sl.a.x, sl.a.y, sl.b.x, sl.b.y, a);
      }
      ctx.restore();

      // --- Cursor: smooth neon dot + dotted trail ---
      if (cur) {
        const tNow = performance.now();
        const trail = cursorTrailRef.current;
        const last = trail.length ? trail[trail.length - 1] : null;

        // Add points only when meaningfully moved (reduces jitter + work)
        if (!last || Math.hypot(cur.x - last.x, cur.y - last.y) >= 3) {
          trail.push({ x: cur.x, y: cur.y, t: tNow });
        }
        // Keep ~140ms of trail
        while (trail.length && tNow - trail[0]!.t > 140) trail.shift();

        ctx.save();
        // Trail first (older -> lower alpha)
        for (let i = 1; i < trail.length; i++) {
          const p0 = trail[i - 1]!;
          const p1 = trail[i]!;
          const ageMs = tNow - p1.t;
          const fade = clamp01(1 - ageMs / 140);
          drawNeonDottedSegment(ctx, p0.x, p0.y, p1.x, p1.y, 0.9 * fade);
        }

        // Cursor dot
        ctx.globalAlpha = 1;
        ctx.fillStyle = "rgba(56,189,248,0.95)";
        ctx.shadowColor = "rgba(56,189,248,1)";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(cur.x, cur.y, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else {
        // No cursor detected: clear trail so it doesn't “teleport” on re-acquire.
        if (cursorTrailRef.current.length) cursorTrailRef.current = [];
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
  const maxBoxW = Math.max(240, w - 80);
  const padX = 28;
  const padY = 14;

  // Prefer splitting on arrows to keep instructions readable.
  const arrowParts = text.split("→").map((s) => s.trim()).filter(Boolean);
  let lines: string[] = [text];
  if (arrowParts.length >= 3) {
    lines = [arrowParts[0], `${arrowParts[1]} → ${arrowParts.slice(2).join(" → ")}`];
  } else if (arrowParts.length === 2) {
    lines = [arrowParts[0], arrowParts[1]];
  }

  let fontSize = 18;
  const fontFamily = "ui-sans-serif, system-ui";
  const measureMaxLineW = () => Math.max(...lines.map((ln) => ctx.measureText(ln).width));

  // Downshift font size if we would overflow the box.
  ctx.font = `800 ${fontSize}px ${fontFamily}`;
  while (fontSize > 14 && measureMaxLineW() + padX * 2 > maxBoxW) {
    fontSize -= 1;
    ctx.font = `800 ${fontSize}px ${fontFamily}`;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lineH = Math.round(fontSize * 1.25);
  const tw = measureMaxLineW();
  const boxW = Math.min(maxBoxW, tw + padX * 2);
  const boxH = lines.length === 1 ? 50 : padY * 2 + lineH * lines.length + 6;
  const bx = (w - boxW) / 2;
  const by = h / 2 - boxH / 2;

  ctx.fillStyle = "rgba(0,0,0,0.6)";
  roundRect(ctx, bx, by, boxW, boxH, 14);
  ctx.fill();

  ctx.fillStyle = color;
  if (lines.length === 1) {
    ctx.fillText(lines[0] ?? "", w / 2, h / 2);
  } else {
    const startY = h / 2 - (lineH * (lines.length - 1)) / 2;
    for (let i = 0; i < lines.length; i++) {
      ctx.fillText(lines[i] ?? "", w / 2, startY + i * lineH);
    }
  }
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
  sprite: HTMLImageElement,
) {
  const baseAngle = Math.atan2(fruit.splitNormal.y, fruit.splitNormal.x);
  const x = fruit.pos.x + fruit.splitNormal.x * fruit.splitOffset * side;
  const y = fruit.pos.y + fruit.splitNormal.y * fruit.splitOffset * side;
  if (sprite.complete && sprite.naturalWidth > 0) {
    drawImageCentered(ctx, sprite, x, y, fruit.radius * 2.2, fruit.radius * 2.2, baseAngle + fruit.rotation * side, 0.95);
    return;
  }

  drawFallbackFruit(ctx, fruit.kind, x, y, fruit.radius * 0.78);
}

function drawImageCentered(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number,
  alpha = 1,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, -w / 2, -h / 2, w, h);
  ctx.restore();
}

function drawFallbackFruit(ctx: CanvasRenderingContext2D, kind: string, x: number, y: number, radius: number) {
  ctx.save();
  ctx.shadowColor = fruitColor(kind);
  ctx.shadowBlur = 20;
  ctx.fillStyle = fruitColor(kind);
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

type SpriteKey =
  | "appleWhole"
  | "applePart1"
  | "applePart2"
  | "orangeWhole"
  | "orangePart1"
  | "orangePart2"
  | "pineappleWhole"
  | "pineapplePart1"
  | "pineapplePart2"
  | "watermelonWhole"
  | "watermelonPart1"
  | "watermelonPart2";

function createSpriteCache(): Record<SpriteKey, HTMLImageElement> {
  const make = (src: string) => {
    const img = new Image();
    img.src = src;
    return img;
  };

  return {
    appleWhole: make("/assets/fruit-ninja/apple.png"),
    applePart1: make("/assets/fruit-ninja/apple_half_1.png"),
    applePart2: make("/assets/fruit-ninja/apple_half_2.png"),
    orangeWhole: make("/assets/fruit-ninja/orange.png"),
    orangePart1: make("/assets/fruit-ninja/orange_half_1.png"),
    orangePart2: make("/assets/fruit-ninja/orange_half_2.png"),
    pineappleWhole: make("/assets/fruit-ninja/pineapple.png"),
    pineapplePart1: make("/assets/fruit-ninja/pineapple_half_1.png"),
    pineapplePart2: make("/assets/fruit-ninja/pineapple_half_2.png"),
    watermelonWhole: make("/assets/fruit-ninja/watermelon.png"),
    watermelonPart1: make("/assets/fruit-ninja/watermelon_half_1.png"),
    watermelonPart2: make("/assets/fruit-ninja/watermelon_half_2.png"),
  };
}

function spriteForFruitKind(kind: string): { whole: SpriteKey; part1: SpriteKey; part2: SpriteKey } {
  switch (kind) {
    case "orange":
      return { whole: "orangeWhole", part1: "orangePart1", part2: "orangePart2" };
    case "lemon":
      return { whole: "pineappleWhole", part1: "pineapplePart1", part2: "pineapplePart2" };
    case "watermelon":
      return { whole: "watermelonWhole", part1: "watermelonPart1", part2: "watermelonPart2" };
    default:
      return { whole: "appleWhole", part1: "applePart1", part2: "applePart2" };
  }
}

function drawNeonDottedSegment(
  ctx: CanvasRenderingContext2D,
  ax: number,
  ay: number,
  bx: number,
  by: number,
  intensity: number,
) {
  const dx = bx - ax;
  const dy = by - ay;
  const len = Math.hypot(dx, dy);
  if (len < 0.5) return;

  // Controls “smoothness” of the dotted look
  const step = len < 80 ? 6 : 8;
  const dots = Math.max(2, Math.ceil(len / step));

  ctx.save();
  ctx.shadowColor = "rgba(56,189,248,1)";
  ctx.shadowBlur = 22 * intensity;

  for (let i = 0; i <= dots; i++) {
    const t = i / dots;
    const x = ax + dx * t;
    const y = ay + dy * t;

    // Fade along the segment for a “comet” feel.
    const along = 0.6 + 0.4 * (1 - t);
    const a = 0.9 * intensity * along;

    ctx.globalAlpha = a;
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(x, y, 3.6 * (0.6 + 0.4 * intensity), 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.55 * a;
    ctx.fillStyle = "rgba(56,189,248,0.95)";
    ctx.beginPath();
    ctx.arc(x, y, 2.4 * (0.6 + 0.4 * intensity), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
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
