"use client";

import * as React from "react";
import type { HandDetectionResult } from "@/lib/handDetection";

export function WebcamFeed({
  videoRef,
  webcamStatus,
  hand,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  webcamStatus: string;
  hand: HandDetectionResult;
}) {
  return (
    <div className="panel p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="font-extrabold tracking-tight">Webcam</div>
        <div className="text-xs text-white/60">{webcamStatus}</div>
      </div>
      <div className="mt-2">
        <video ref={videoRef} className="w-full rounded-xl border border-white/10 bg-black/30" playsInline muted />
      </div>
      <div className="mt-2 text-xs text-white/70">
        Detection confidence: <span className="font-bold">{Math.round(hand.confidence * 100)}%</span>
      </div>
      <div className="mt-1 text-xs text-white/50">Tip: good lighting improves detection.</div>
    </div>
  );
}

