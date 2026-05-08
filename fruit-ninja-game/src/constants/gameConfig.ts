export const gameConfig = {
  canvas: {
    width: 900,
    height: 560,
  },
  spawn: {
    initialPerSecond: 0.9,
    maxPerSecond: 2.4,
    rampSeconds: 90,
  },
  physics: {
    gravity: 580, // px/s^2 — low gravity = high arcs, ~2.5s hang time
    airDrag: 0.9995,
  },
  slash: {
    minSpeedPxPerSec: 1100,
    trailSeconds: 0.16,
    cooldownMs: 110,
  },
  lives: {
    start: 3,
  },
  scoring: {
    baseFruitPoints: 10,
    comboWindowSeconds: 1.2,
    comboBonusPerHit: 2,
    maxComboMultiplier: 5,
  },
} as const;

