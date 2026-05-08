import * as React from "react";

export type WebcamState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; stream: MediaStream }
  | { status: "error"; message: string };

export function useWebcam() {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [state, setState] = React.useState<WebcamState>({ status: "idle" });
  const debugRef = React.useRef({ stopCalls: 0, cleanupCalls: 0 });

  const start = React.useCallback(async () => {
    setState({ status: "loading" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
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
    fetch("http://127.0.0.1:7723/ingest/c9380e78-3eea-49c4-9a01-43685a1d3819", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e738c9" },
      body: JSON.stringify({
        sessionId: "e738c9",
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "src/hooks/useWebcam.ts:stop",
        message: "stop() called",
        data: { status: state.status, stopCalls: debugRef.current.stopCalls },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion agent log

    if (state.status === "ready") {
      for (const t of state.stream.getTracks()) t.stop();
    }
    setState({ status: "idle" });
  }, [state]);

  React.useEffect(() => {
    return () => {
      // #region agent log
      debugRef.current.cleanupCalls += 1;
      fetch("http://127.0.0.1:7723/ingest/c9380e78-3eea-49c4-9a01-43685a1d3819", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "e738c9" },
        body: JSON.stringify({
          sessionId: "e738c9",
          runId: "pre-fix",
          hypothesisId: "H1",
          location: "src/hooks/useWebcam.ts:useEffectCleanup",
          message: "cleanup -> calling stop()",
          data: { status: state.status, cleanupCalls: debugRef.current.cleanupCalls },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion agent log
      stop();
    };
  }, [stop]);

  return { videoRef, state, start, stop };
}

