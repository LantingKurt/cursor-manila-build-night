"use client";

import { useRef } from "react";
import { Controls } from "@/components/Controls";
import { GameCanvas } from "@/components/GameCanvas";
import { Leaderboard } from "@/components/Leaderboard";
import { Stats } from "@/components/Stats";
import { gameConfig } from "@/constants/gameConfig";
import { useGameAudio } from "@/hooks/useGameAudio";
import { useGame } from "@/hooks/useGame";
import { useHandDetection } from "@/hooks/useHandDetection";
import { useWebcam } from "@/hooks/useWebcam";
import type { Vec2 } from "@/lib/physics";

export default function Home() {
  const game = useGame();
  const webcam = useWebcam();
  const hand = useHandDetection(webcam.videoRef);
  const lastSlashMsRef = useRef(0);
  useGameAudio(game.state, hand.slash?.tMs ?? null);

  // Map hand keypoint (video px) → canvas coords.
  // X is flipped because the video is CSS-mirrored (scaleX(-1)) so visual left = raw right.
  const cursor =
    hand.result.primaryPoint && webcam.videoRef.current
      ? {
          x: (1 - hand.result.primaryPoint.x / (webcam.videoRef.current.videoWidth || 1)) * gameConfig.canvas.width,
          y: (hand.result.primaryPoint.y / (webcam.videoRef.current.videoHeight || 1)) * gameConfig.canvas.height,
        }
      : null;

  // Submit slash events via effect (never during render to avoid update loops).
  useEffect(() => {
    if (!hand.slash) return;
    if (hand.slash.tMs === lastSlashMsRef.current) return;
    lastSlashMsRef.current = hand.slash.tMs;

    const v = webcam.videoRef.current;
    if (!v || v.videoWidth <= 0 || v.videoHeight <= 0) return;

    const vw = v.videoWidth;
    const vh = v.videoHeight;
    // Mirror x to match the CSS-flipped video display.
    const a = {
      x: (1 - hand.slash.a.x / vw) * gameConfig.canvas.width,
      y: (hand.slash.a.y / vh) * gameConfig.canvas.height,
    };
    const b = {
      x: (1 - hand.slash.b.x / vw) * gameConfig.canvas.width,
      y: (hand.slash.b.y / vh) * gameConfig.canvas.height,
    };
    game.submitSlash(a, b, hand.slash.tMs);
  }, [hand.slash, game, webcam.videoRef]);

  const leaderboardEnabled = process.env.NEXT_PUBLIC_LEADERBOARD_ENABLED !== "false";

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <header className="px-5 pt-4 pb-3 flex items-center justify-between gap-3 shrink-0">
        <div>
          <div className="text-lg font-black tracking-tight">Fruit Ninja (Webcam)</div>
          <div className="text-sm text-white/55">Move your hand to slash fruits</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <button
            className="btn"
            onClick={webcam.start}
            disabled={webcam.state.status === "loading" || webcam.state.status === "ready"}
          >
            {webcam.state.status === "loading"
              ? "Starting…"
              : webcam.state.status === "ready"
              ? "Webcam On"
              : "Enable Webcam"}
          </button>
          <button
            className="btn"
            onClick={hand.start}
            disabled={hand.state.status === "loadingModel" || hand.state.status === "ready"}
          >
            {hand.state.status === "loadingModel"
              ? "Loading MediaPipe…"
              : hand.state.status === "ready"
              ? "MediaPipe Ready ✓"
              : "Load MediaPipe"}
          </button>
        </div>
      </header>

      <main className="px-5 pb-5 grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4 items-start">
        {/*
          GameCanvas renders:
          - <video ref={videoRef}> as full background (mirrored webcam feed)
          - transparent <canvas> on top for fruits, slashes, and the finger cursor ring
        */}
        <section className="min-w-0">
          <GameCanvas
            state={game.state}
            videoRef={webcam.videoRef}
            cursorRef={cursorRef}
          />
          {webcam.state.status === "error" && (
            <div className="mt-2 text-sm text-rose-400">
              Webcam error: {(webcam.state as { status: "error"; message: string }).message}
            </div>
          )}
          {hand.state.status === "error" && (
            <div className="mt-2 text-sm text-rose-400">
              Model error: {(hand.state as { status: "error"; message: string }).message}
            </div>
          )}
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
          <Leaderboard enabled={leaderboardEnabled} />
          <div className="panel p-3 text-sm text-white/70 leading-relaxed">
            <div className="font-extrabold text-white mb-1">How to play</div>
            <ul className="list-disc pl-5 space-y-1">
              <li>Enable Webcam (allows camera access)</li>
              <li>Load MediaPipe (downloads once, runs on GPU)</li>
              <li>Press Start — your live video is the game background</li>
              <li>Move your <b>hand</b> — ring cursor tracks your palm</li>
              <li>Swipe quickly to <b>slash</b> fruits as they fly up</li>
            </ul>
          </div>
          <div className="panel p-3 text-xs text-white/55">
            Hand confidence: <span className="font-bold text-white/80">{Math.round(hand.result.confidence * 100)}%</span>
            {" · "}
            Webcam: <span className="font-bold text-white/80">{webcam.state.status}</span>
          </div>
        </aside>
      </main>
    </div>
  );
}
