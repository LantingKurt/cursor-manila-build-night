import * as React from "react";
import { createHandDetectorState, detectHands, loadHandDetector, type HandDetectionResult, type SlashEvent } from "@/lib/handDetection";

export type HandTrackingState =
  | { status: "idle" }
  | { status: "loadingModel" }
  | { status: "ready" }
  | { status: "error"; message: string };

type Options = {
  onCursor?: (p: { x: number; y: number } | null) => void;
  onSlash?: (s: SlashEvent) => void;
};

export function useHandDetection(videoRef: React.RefObject<HTMLVideoElement | null>, options: Options = {}) {
  const detectorRef = React.useRef(createHandDetectorState());
  const [state, setState] = React.useState<HandTrackingState>({ status: "idle" });
  const [result, setResult] = React.useState<HandDetectionResult>({ hands: [], confidence: 0 });
  const lastUiUpdateMsRef = React.useRef(0);

  const start = React.useCallback(async () => {
    setState({ status: "loadingModel" });
    const next = await loadHandDetector(detectorRef.current);
    detectorRef.current = next;
    if (next.error) {
      setState({ status: "error", message: next.error });
      return;
    }
    setState({ status: "ready" });
  }, []);

  React.useEffect(() => {
    if (state.status !== "ready") return;

    let raf = 0;
    let alive = true;

    // Non-overlapping loop: schedule next frame only AFTER current detect finishes.
    // This prevents race conditions on detectorRef when async detects pile up.
    const tick = async () => {
      if (!alive) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2) {
        try {
          const out = await detectHands(detectorRef.current, video);
          if (!alive) return;
          detectorRef.current = out.nextState;

          // Hot path: update cursor via callback without forcing React re-renders.
          options.onCursor?.(out.result.primaryPoint ? { x: out.result.primaryPoint.x, y: out.result.primaryPoint.y } : null);

          // Hot path: fire slashes directly.
          if (out.slash) options.onSlash?.(out.slash);

          // Cold path UI: throttle React state updates (confidence panel, etc).
          const now = performance.now();
          if (now - lastUiUpdateMsRef.current >= 160) {
            lastUiUpdateMsRef.current = now;
            setResult(out.result);
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          setState({ status: "error", message: msg });
          return;
        }
      }
      if (alive) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [state.status, videoRef, options]);

  return { state, start, result };
}

