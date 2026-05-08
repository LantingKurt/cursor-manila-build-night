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
    gravity: 1800, // px/s^2
    airDrag: 0.996,
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

