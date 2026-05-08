import { clamp } from "@/lib/utils";

export type Vec2 = { x: number; y: number };

export function add(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function sub(a: Vec2, b: Vec2): Vec2 {
  return { x: a.x - b.x, y: a.y - b.y };
}

export function mul(a: Vec2, s: number): Vec2 {
  return { x: a.x * s, y: a.y * s };
}

export function len(a: Vec2) {
  return Math.hypot(a.x, a.y);
}

export function norm(a: Vec2): Vec2 {
  const l = len(a);
  return l > 1e-6 ? { x: a.x / l, y: a.y / l } : { x: 0, y: 0 };
}

export function segmentIntersectsCircle(a: Vec2, b: Vec2, c: Vec2, r: number) {
  // Closest point on segment to circle center
  const ab = sub(b, a);
  const ac = sub(c, a);
  const ab2 = ab.x * ab.x + ab.y * ab.y;
  const t = ab2 > 1e-6 ? clamp((ac.x * ab.x + ac.y * ab.y) / ab2, 0, 1) : 0;
  const p = { x: a.x + ab.x * t, y: a.y + ab.y * t };
  const d = len(sub(c, p));
  return d <= r;
}

