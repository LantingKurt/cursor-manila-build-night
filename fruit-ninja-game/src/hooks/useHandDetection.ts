import * as React from "react";
import { createHandDetectorState, detectHands, loadHandDetector, type HandDetectionResult, type SlashEvent } from "@/lib/handDetection";

export type HandTrackingState =
  | { status: "idle" }
  | { status: "loadingModel" }
  | { status: "ready" }
  | { status: "error"; message: string };

export function useHandDetection(videoRef: React.RefObject<HTMLVideoElement | null>) {
  const detectorRef = React.useRef(createHandDetectorState());
  const [state, setState] = React.useState<HandTrackingState>({ status: "idle" });
  const [result, setResult] = React.useState<HandDetectionResult>({ hands: [], confidence: 0 });
  const [slash, setSlash] = React.useState<SlashEvent | null>(null);

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

    const tick = async () => {
      if (!alive) return;
      raf = requestAnimationFrame(tick);
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      try {
        const out = await detectHands(detectorRef.current, video);
        detectorRef.current = out.nextState;
        setResult(out.result);
        setSlash(out.slash);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        setState({ status: "error", message: msg });
      }
    };

    raf = requestAnimationFrame(tick);
    return () => {
      alive = false;
      if (raf) cancelAnimationFrame(raf);
    };
  }, [state.status, videoRef]);

  return { state, start, result, slash };
}

