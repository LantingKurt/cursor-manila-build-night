import { gameConfig } from "@/constants/gameConfig";
import { segmentIntersectsCircle, type Vec2 } from "@/lib/physics";
import { clamp, rand, uuid } from "@/lib/utils";

export type GamePhase = "menu" | "playing" | "paused" | "gameOver";

export type FruitKind = "apple" | "orange" | "lemon" | "watermelon";

export type Fruit = {
  id: string;
  kind: FruitKind;
  points: number;
  pos: Vec2;
  vel: Vec2;
  radius: number;
  sliced: boolean;
  spawnedAtMs: number;
};

export type Slash = {
  id: string;
  a: Vec2;
  b: Vec2;
  tMs: number;
};

export type GameState = {
  phase: GamePhase;
  score: number;
  lives: number;
  combo: number;
  bestCombo: number;
  fruits: Fruit[];
  slashes: Slash[];
  lastSpawnMs: number;
  startMs: number;
  lastSliceMs: number;
};

export type StepInput = {
  nowMs: number;
  dt: number; // seconds
  canvas: { w: number; h: number };
  slash?: { a: Vec2; b: Vec2; tMs: number } | null;
};

export function createInitialState(nowMs: number): GameState {
  return {
    phase: "menu",
    score: 0,
    lives: gameConfig.lives.start,
    combo: 0,
    bestCombo: 0,
    fruits: [],
    slashes: [],
    lastSpawnMs: nowMs,
    startMs: nowMs,
    lastSliceMs: 0,
  };
}

export function startGame(state: GameState, nowMs: number): GameState {
  const s = { ...state };
  s.phase = "playing";
  s.score = 0;
  s.lives = gameConfig.lives.start;
  s.combo = 0;
  s.bestCombo = 0;
  s.fruits = [];
  s.slashes = [];
  s.lastSpawnMs = nowMs;
  s.startMs = nowMs;
  s.lastSliceMs = 0;
  return s;
}

export function setPaused(state: GameState, paused: boolean): GameState {
  if (state.phase === "menu" || state.phase === "gameOver") return state;
  return { ...state, phase: paused ? "paused" : "playing" };
}

function spawnRate(nowMs: number, startMs: number) {
  const t = clamp((nowMs - startMs) / 1000 / gameConfig.spawn.rampSeconds, 0, 1);
  return gameConfig.spawn.initialPerSecond + (gameConfig.spawn.maxPerSecond - gameConfig.spawn.initialPerSecond) * t;
}

function randomFruitKind(): FruitKind {
  const r = Math.random();
  if (r < 0.35) return "apple";
  if (r < 0.62) return "orange";
  if (r < 0.82) return "lemon";
  return "watermelon";
}

function fruitPoints(kind: FruitKind) {
  switch (kind) {
    case "watermelon":
      return 18;
    case "lemon":
      return 12;
    default:
      return 10;
  }
}

function fruitRadius(kind: FruitKind) {
  switch (kind) {
    case "watermelon":
      return 34;
    case "orange":
      return 26;
    case "lemon":
      return 22;
    default:
      return 24;
  }
}

function spawnFruit(nowMs: number, w: number, h: number): Fruit {
  const kind = randomFruitKind();
  const radius = fruitRadius(kind);

  // Spawn just below the bottom edge, random x.
  const x = rand(radius + 40, w - radius - 40);
  const y = h + radius + 8;

  // Launch upward with enough velocity to arc well above the canvas.
  // With gravity 580 px/s², vy=-900 gives apex ≈ 700px above spawn = ~top of screen.
  const vy = rand(-960, -780);
  const vx = rand(-180, 180);

  return {
    id: uuid(),
    kind,
    points: fruitPoints(kind),
    pos: { x, y },
    vel: { x: vx, y: vy },
    radius,
    sliced: false,
    spawnedAtMs: nowMs,
  };
}

function applyCombo(state: GameState, nowMs: number) {
  const within = state.lastSliceMs > 0 && (nowMs - state.lastSliceMs) / 1000 <= gameConfig.scoring.comboWindowSeconds;
  const combo = within ? state.combo + 1 : 1;
  const bestCombo = Math.max(state.bestCombo, combo);
  return { combo, bestCombo };
}

export function stepGame(prev: GameState, input: StepInput): GameState {
  if (prev.phase !== "playing") return prev;

  const { nowMs, dt, canvas } = input;
  const { w, h } = canvas;

  const gravity = gameConfig.physics.gravity;
  const drag = gameConfig.physics.airDrag;

  let state: GameState = { ...prev };

  // Register slash (used both for rendering and collision checks).
  if (input.slash) {
    const s: Slash = { id: uuid(), a: input.slash.a, b: input.slash.b, tMs: input.slash.tMs };
    state.slashes = [...state.slashes, s].slice(-16);
  }

  // Spawn fruits with time-based rate.
  const rate = spawnRate(nowMs, state.startMs);
  const minIntervalMs = 1000 / rate;
  if (nowMs - state.lastSpawnMs >= minIntervalMs) {
    state.lastSpawnMs = nowMs;
    state.fruits = [...state.fruits, spawnFruit(nowMs, w, h)];
  }

  // Move fruits and apply physics.
  const fruits: Fruit[] = [];
  let lives = state.lives;
  let score = state.score;
  let combo = state.combo;
  let bestCombo = state.bestCombo;
  let lastSliceMs = state.lastSliceMs;

  for (const f0 of state.fruits) {
    let f = { ...f0 };
    f.vel = { x: f.vel.x * Math.pow(drag, dt * 60), y: f.vel.y * Math.pow(drag, dt * 60) + gravity * dt };
    f.pos = { x: f.pos.x + f.vel.x * dt, y: f.pos.y + f.vel.y * dt };

    // Miss = fruit came back down and fully crossed the bottom (fell off screen).
    // Only penalise once it's heading downward, so the initial upward spawn doesn't trigger it.
    const fellOffBottom = f.vel.y > 0 && f.pos.y - f.radius > h + 10;
    if (!f.sliced && fellOffBottom) {
      lives -= 1;
      continue; // despawn missed fruit
    }
    // Also despawn sliced fruits that fall off bottom (no penalty).
    if (f.sliced && f.pos.y - f.radius > h + 60) continue;

    // Slash collision.
    if (!f.sliced && input.slash) {
      const hit = segmentIntersectsCircle(input.slash.a, input.slash.b, f.pos, f.radius);
      if (hit) {
        f.sliced = true;
        const comboApplied = applyCombo(state, nowMs);
        combo = comboApplied.combo;
        bestCombo = comboApplied.bestCombo;
        lastSliceMs = nowMs;

        const mult = clamp(1 + Math.floor(combo / 3), 1, gameConfig.scoring.maxComboMultiplier);
        score += f.points * mult;
      }
    }

    // Keep fruit if still relevant (sliced fruits could later become pieces; for boilerplate we just keep briefly).
    const tooOldSliced = f.sliced && nowMs - f.spawnedAtMs > 1200;
    if (!tooOldSliced) fruits.push(f);
  }

  // Combo decay: if window elapsed, reset combo.
  if (combo > 0 && lastSliceMs > 0 && (nowMs - lastSliceMs) / 1000 > gameConfig.scoring.comboWindowSeconds) {
    combo = 0;
  }

  state = { ...state, fruits, lives, score, combo, bestCombo, lastSliceMs };

  if (state.lives <= 0) {
    state.phase = "gameOver";
  }

  // Prune slashes (trail)
  const trailMs = gameConfig.slash.trailSeconds * 1000;
  state.slashes = state.slashes.filter((s) => nowMs - s.tMs <= trailMs);

  return state;
}

