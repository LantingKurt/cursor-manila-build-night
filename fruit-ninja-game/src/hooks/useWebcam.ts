import * as React from "react";
import { debugLog } from "@/lib/debugLog";

export type WebcamState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; stream: MediaStream }
  | { status: "error"; message: string };

export function useWebcam() {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [state, setState] = React.useState<WebcamState>({ status: "idle" });
  const debugRef = React.useRef({ stopCalls: 0, cleanupCalls: 0 });
  const streamRef = React.useRef<MediaStream | null>(null);
  const stateRef = React.useRef<WebcamState>(state);
  React.useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const start = React.useCallback(async () => {
    setState({ status: "loading" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setState({ status: "ready", stream });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setState({ status: "error", message });
    }
  }, []);

  const stop = React.useCallback(() => {
    // #region agent log
    debugRef.current.stopCalls += 1;
    debugLog({
      sessionId: "e738c9",
      runId: "pre-fix",
      hypothesisId: "H1",
      location: "src/hooks/useWebcam.ts:stop",
      message: "stop() called",
      data: { status: stateRef.current.status, stopCalls: debugRef.current.stopCalls },
      timestamp: Date.now(),
    });
    // #endregion agent log

    const s = streamRef.current;
    if (s) {
      for (const t of s.getTracks()) t.stop();
      streamRef.current = null;
    }
    // Avoid redundant updates that can contribute to loops.
    setState((prev) => (prev.status === "idle" ? prev : { status: "idle" }));
  }, []);

  React.useEffect(() => {
    return () => {
      // #region agent log
      debugRef.current.cleanupCalls += 1;
      debugLog({
        sessionId: "e738c9",
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "src/hooks/useWebcam.ts:useEffectCleanup",
        message: "cleanup -> calling stop()",
        data: { status: stateRef.current.status, cleanupCalls: debugRef.current.cleanupCalls },
        timestamp: Date.now(),
      });
      // #endregion agent log
      stop();
    };
  }, [stop]);

  return { videoRef, state, start, stop };
}

