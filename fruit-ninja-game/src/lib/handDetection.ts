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
  // MediaPipe Tasks Vision (HandLandmarker) is loaded dynamically for bundler compatibility.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  detector: any | null;
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
    const { FilesetResolver, HandLandmarker } = await import("@mediapipe/tasks-vision");

    // Loads WASM + model assets from CDN by default.
    // For production, copy assets under /public/models and point to your own path.
    const fileset = await FilesetResolver.forVisionTasks(
      "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm",
    );

    const detector = await HandLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath:
          "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
      },
      runningMode: "VIDEO",
      numHands: 2,
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
    return {
      result: { hands: [], confidence: 0 },
      slash: null,
      nextState: state,
    };
  }

  const tMs = nowMs();
  // MediaPipe Tasks Vision returns landmarks normalized (0..1) + handedness.
  const mp = state.detector.detectForVideo(video, tMs) as {
    landmarks?: Array<Array<{ x: number; y: number; z?: number }>>;
    handednesses?: Array<Array<{ categoryName?: string; score?: number }>>;
  };

  let primaryPoint: HandPoint | undefined;
  let confidence = 0;

  const normalizedHands =
    mp.landmarks?.map((handLm, idx) => {
      // Index finger tip is landmark 8 in MediaPipe Hands.
      const indexTip = handLm[8];
      if (!primaryPoint && indexTip) {
        primaryPoint = {
          x: indexTip.x * video.videoWidth,
          y: indexTip.y * video.videoHeight,
          z: indexTip.z,
        };
      }

      const handed = mp.handednesses?.[idx]?.[0]?.categoryName ?? "Unknown";
      const score = mp.handednesses?.[idx]?.[0]?.score;
      confidence = Math.max(confidence, typeof score === "number" ? score : 0.6);

      return {
        handedness: (handed === "Left" || handed === "Right" ? handed : "Unknown") as "Left" | "Right" | "Unknown",
        keypoints: handLm.map((k) => ({ x: k.x * video.videoWidth, y: k.y * video.videoHeight, z: k.z })),
        score,
      };
    }) ?? [];

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

