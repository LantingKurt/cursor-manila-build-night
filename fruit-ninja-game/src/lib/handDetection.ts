import * as handPoseDetection from "@tensorflow-models/hand-pose-detection";
import "@tensorflow/tfjs";
import { nowMs } from "@/lib/utils";

export type HandPoint = { x: number; y: number; z?: number };

export type HandDetectionResult = {
  hands: Array<{
    handedness: "Left" | "Right" | "Unknown";
    keypoints: HandPoint[];
    score?: number;
  }>;
  // A single "best" point for slashing control (e.g., index finger tip).
  primaryPoint?: HandPoint;
  confidence: number;
};

export type SlashEvent = {
  a: { x: number; y: number };
  b: { x: number; y: number };
  speedPxPerSec: number;
  tMs: number;
};

export type HandDetectorState = {
  detector: handPoseDetection.HandDetector | null;
  loading: boolean;
  error: string | null;
  lastPoint: { x: number; y: number; tMs: number } | null;
  lastSlashMs: number;
};

export function createHandDetectorState(): HandDetectorState {
  return {
    detector: null,
    loading: false,
    error: null,
    lastPoint: null,
    lastSlashMs: 0,
  };
}

export async function loadHandDetector(state: HandDetectorState): Promise<HandDetectorState> {
  if (state.detector || state.loading) return state;
  try {
    const s: HandDetectorState = { ...state, loading: true, error: null };
    const detector = await handPoseDetection.createDetector(handPoseDetection.SupportedModels.MediaPipeHands, {
      runtime: "mediapipe",
      modelType: "full",
      maxHands: 2,
      // MediaPipe assets are served from CDN by default; you can override with local files under /public/models.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      solutionPath: "https://cdn.jsdelivr.net/npm/@mediapipe/hands",
    } as any);
    return { ...s, detector, loading: false };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { ...state, loading: false, error: message };
  }
}

export async function detectHands(
  state: HandDetectorState,
  video: HTMLVideoElement,
): Promise<{ result: HandDetectionResult; slash: SlashEvent | null; nextState: HandDetectorState }> {
  if (!state.detector) {
    return {
      result: { hands: [], confidence: 0 },
      slash: null,
      nextState: state,
    };
  }

  const tMs = nowMs();
  const hands = await state.detector.estimateHands(video, { flipHorizontal: true });

  let primaryPoint: HandPoint | undefined;
  let confidence = 0;

  const normalizedHands = hands.map((h) => {
    // Index finger tip tends to be stable for slashing.
    const indexTip = h.keypoints?.find((k) => k.name === "index_finger_tip");
    if (!primaryPoint && indexTip) primaryPoint = { x: indexTip.x, y: indexTip.y, z: indexTip.z };
    confidence = Math.max(confidence, typeof h.score === "number" ? h.score : 0.6);
    return {
      handedness: (h.handedness as "Left" | "Right" | undefined) ?? "Unknown",
      keypoints: (h.keypoints ?? []).map((k) => ({ x: k.x, y: k.y, z: k.z })),
      score: h.score,
    };
  });

  // Slash detection: based on primary point speed.
  let slash: SlashEvent | null = null;
  let nextState: HandDetectorState = state;

  if (primaryPoint) {
    const p = { x: primaryPoint.x, y: primaryPoint.y, tMs };
    if (state.lastPoint) {
      const dt = Math.max(1, p.tMs - state.lastPoint.tMs) / 1000;
      const dx = p.x - state.lastPoint.x;
      const dy = p.y - state.lastPoint.y;
      const speed = Math.hypot(dx, dy) / dt;

      // Default thresholds; game layer can gate with config too.
      if (speed > 1100 && tMs - state.lastSlashMs > 110) {
        slash = {
          a: { x: state.lastPoint.x, y: state.lastPoint.y },
          b: { x: p.x, y: p.y },
          speedPxPerSec: speed,
          tMs,
        };
        nextState = { ...state, lastSlashMs: tMs, lastPoint: p };
      } else {
        nextState = { ...state, lastPoint: p };
      }
    } else {
      nextState = { ...state, lastPoint: p };
    }
  }

  return {
    result: {
      hands: normalizedHands,
      primaryPoint,
      confidence: clamp01(confidence),
    },
    slash,
    nextState,
  };
}

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

