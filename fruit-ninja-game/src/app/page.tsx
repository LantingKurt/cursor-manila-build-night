"use client";

import { Controls } from "@/components/Controls";
import { GameCanvas } from "@/components/GameCanvas";
import { Leaderboard } from "@/components/Leaderboard";
import { Stats } from "@/components/Stats";
import { WebcamFeed } from "@/components/WebcamFeed";
import { gameConfig } from "@/constants/gameConfig";
import { useGame } from "@/hooks/useGame";
import { useHandDetection } from "@/hooks/useHandDetection";
import { useWebcam } from "@/hooks/useWebcam";

export default function Home() {
  const game = useGame();
  const webcam = useWebcam();
  const hand = useHandDetection(webcam.videoRef);

  // Map the detector's primary point (video pixel coords) into canvas coords.
  const cursor =
    hand.result.primaryPoint && webcam.videoRef.current
      ? {
          x: (hand.result.primaryPoint.x / webcam.videoRef.current.videoWidth) * gameConfig.canvas.width,
          y: (hand.result.primaryPoint.y / webcam.videoRef.current.videoHeight) * gameConfig.canvas.height,
        }
      : null;

  // When slash detected, submit into game engine (in canvas coordinates).
  // This is deliberately simple boilerplate; refine by using the raw SlashEvent points.
  if (hand.slash && webcam.videoRef.current) {
    const vw = webcam.videoRef.current.videoWidth || 1;
    const vh = webcam.videoRef.current.videoHeight || 1;
    const a = { x: (hand.slash.a.x / vw) * gameConfig.canvas.width, y: (hand.slash.a.y / vh) * gameConfig.canvas.height };
    const b = { x: (hand.slash.b.x / vw) * gameConfig.canvas.width, y: (hand.slash.b.y / vh) * gameConfig.canvas.height };
    game.submitSlash(a, b, hand.slash.tMs);
  }

  const leaderboardEnabled = process.env.NEXT_PUBLIC_LEADERBOARD_ENABLED !== "false";

  return (
    <div className="flex flex-1 flex-col">
      <header className="px-5 pt-5 pb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-lg font-black tracking-tight">Fruit Ninja (Webcam)</div>
          <div className="text-sm text-white/60">Slash with your hand (TensorFlow hand pose)</div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={webcam.start} disabled={webcam.state.status === "loading" || webcam.state.status === "ready"}>
            {webcam.state.status === "ready" ? "Webcam Ready" : "Enable Webcam"}
          </button>
          <button className="btn" onClick={hand.start} disabled={hand.state.status === "loadingModel" || hand.state.status === "ready"}>
            {hand.state.status === "ready" ? "Model Ready" : "Load Model"}
          </button>
        </div>
      </header>

      <main className="px-5 pb-6 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-4 items-start">
        <section className="min-w-0">
          <GameCanvas state={game.state} cursor={cursor} />
        </section>

        <aside className="flex flex-col gap-3">
          <Stats state={game.state} />
          <Controls
            phase={game.state.phase}
            onStart={game.start}
            onPause={game.pause}
            onResume={game.resume}
            onReset={game.reset}
          />
          <WebcamFeed
            videoRef={webcam.videoRef}
            webcamStatus={webcam.state.status}
            hand={hand.result}
          />
          <Leaderboard enabled={leaderboardEnabled} />
          <div className="panel p-3 text-sm text-white/70 leading-relaxed">
            <div className="font-extrabold text-white mb-1">How it works</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Enable webcam</li>
              <li>Load hand model (downloads on first run)</li>
              <li>Start game and slash fruits by moving your hand quickly</li>
            </ul>
          </div>
        </aside>
      </main>
    </div>
  );
}
