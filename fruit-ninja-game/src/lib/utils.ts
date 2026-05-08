export function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}

export function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function rand(min: number, max: number) {
  return min + Math.random() * (max - min);
}

export function randInt(min: number, max: number) {
  return Math.floor(rand(min, max + 1));
}

export function nowMs() {
  return typeof performance !== "undefined" ? performance.now() : Date.now();
}

export function uuid() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

