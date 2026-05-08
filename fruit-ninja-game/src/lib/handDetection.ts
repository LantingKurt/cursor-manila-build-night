/**
 * Hand detection via MediaPipe Tasks Vision (HandLandmarker).
 * No TensorFlow dependency — pure @mediapipe/tasks-vision.
 *
 * MediaPipe Hand Landmarks (21 points):
 *   0  = wrist
 *   4  = thumb tip
 *   8  = index finger tip
 *   9  = middle finger MCP (knuckle)
 *   12 = middle finger tip
 *   16 = ring finger tip
 *   20 = pinky tip
 */

import { nowMs } from "@/lib/utils";

export type HandPoint = { x: number; y: number; z?: number };

export type HandDetectionResult = {
  hands: Array<{
    handedness: "Left" | "Right" | "Unknown";
    keypoints: HandPoint[];
    score?: number;
  }>;
  primaryPoint?: HandPoint;  // palm-center used for cursor
  confidence: number;
};

export type SlashEvent = {
  a: { x: number; y: number };
  b: { x: number; y: number };
  speedPxPerSec: number;
  tMs: number;
};

export type HandDetectorState = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detector: any | null;
  loading: boolean;
  error: string | null;
  // Track the palm center across frames for slash detection
  lastPalm: { x: number; y: number; tMs: number } | null;
  lastSlashMs: number;
};

export function createHandDetectorState(): HandDetectorState {
  return { detector: null, loading: false, error: null, lastPalm: null, lastSlashMs: 0 };
}

export async function loadHandDetector(state: HandDetectorState): Promise<HandDetectorState> {
  if (state.detector || state.loading) return state;
  try {
    const s: HandDetectorState = { ...state, loading: true, error: null };

    const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");

    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
    );

    const detector = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });

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
    return { result: { hands: [], confidence: 0 }, slash: null, nextState: state };
  }

  const tMs = nowMs();

  const mp = state.detector.detectForVideo(video, tMs) as {
    landmarks?: Array<Array<{ x: number; y: number; z?: number }>>;
    handednesses?: Array<Array<{ categoryName?: string; score?: number }>>;
  };

  let primaryPoint: HandPoint | undefined;
  let confidence = 0;

  const normalizedHands =
    mp.landmarks?.map((handLm, idx) => {
      const vw = video.videoWidth;
      const vh = video.videoHeight;

      // Cursor: index fingertip (lm 8) — precise, follows the fingertip the user sees.
      const indexTip = handLm[8];
      if (!primaryPoint && indexTip) {
        primaryPoint = { x: indexTip.x * vw, y: indexTip.y * vh };
      }

      const handed = mp.handednesses?.[idx]?.[0]?.categoryName ?? "Unknown";
      const score = mp.handednesses?.[idx]?.[0]?.score;
      confidence = Math.max(confidence, typeof score === "number" ? score : 0.6);

      return {
        handedness: (handed === "Left" || handed === "Right" ? handed : "Unknown") as
          | "Left"
          | "Right"
          | "Unknown",
        keypoints: handLm.map((k) => ({ x: k.x * vw, y: k.y * vh, z: k.z })),
        score,
      };
    }) ?? [];

  // --- Slash detection ---
  // Use palm-center speed. Threshold tuned for a natural swipe gesture.
  let slash: SlashEvent | null = null;
  let nextState: HandDetectorState = state;

  if (primaryPoint) {
    const palm = { x: primaryPoint.x, y: primaryPoint.y, tMs };

    if (state.lastPalm) {
      const dt = Math.max(1, palm.tMs - state.lastPalm.tMs) / 1000;
      const dx = palm.x - state.lastPalm.x;
      const dy = palm.y - state.lastPalm.y;
      const speed = Math.hypot(dx, dy) / dt;

      // Slash fires on a fast lateral/diagonal swipe; cooldown stops double-fires.
      if (speed > 900 && tMs - state.lastSlashMs > 90) {
        slash = {
          a: { x: state.lastPalm.x, y: state.lastPalm.y },
          b: { x: palm.x, y: palm.y },
          speedPxPerSec: speed,
          tMs,
        };
        nextState = { ...state, lastSlashMs: tMs, lastPalm: palm };
      } else {
        nextState = { ...state, lastPalm: palm };
      }
    } else {
      nextState = { ...state, lastPalm: palm };
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
