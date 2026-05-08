import * as React from "react";

export type WebcamState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; stream: MediaStream }
  | { status: "error"; message: string };

export function useWebcam() {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [state, setState] = React.useState<WebcamState>({ status: "idle" });

  // Track the active stream in a ref so stop() never closes over stale state.
  const streamRef = React.useRef<MediaStream | null>(null);

  const start = React.useCallback(async () => {
    setState({ status: "loading" });
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        // MediaPipe downscales to ~256 internally; smaller capture cuts GPU upload cost
        // without affecting landmark accuracy.
        video: { facingMode: "user", width: { ideal: 480 }, height: { ideal: 360 } },
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

  // Stable stop: depends on nothing, reads stream from ref.
  const stop = React.useCallback(() => {
    const s = streamRef.current;
    if (s) {
      for (const t of s.getTracks()) t.stop();
      streamRef.current = null;
    }
    // Functional updater avoids the "setState during render" / stale-closure loop:
    // returning prev when already idle tells React to skip re-render.
    setState((prev) => (prev.status === "idle" ? prev : { status: "idle" }));
  }, []); // empty deps → always same reference → cleanup effect never re-runs

  // Cleanup on unmount only.
  React.useEffect(() => {
    return stop;
  }, [stop]);

  return { videoRef, state, start, stop };
}
