import * as React from "react";

export type WebcamState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; stream: MediaStream }
  | { status: "error"; message: string };

export function useWebcam() {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [state, setState] = React.useState<WebcamState>({ status: "idle" });

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
    if (state.status === "ready") {
      for (const t of state.stream.getTracks()) t.stop();
    }
    setState({ status: "idle" });
  }, [state]);

  React.useEffect(() => {
    return () => stop();
  }, [stop]);

  return { videoRef, state, start, stop };
}

