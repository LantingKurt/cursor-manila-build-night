"use client";

import * as React from "react";
import type { GameState } from "@/lib/gameEngine";

type SoundKey = "swipe" | "sliceHit" | "miss" | "gameOver";

function createAudio(src: string, volume: number) {
  const a = new Audio(src);
  a.preload = "auto";
  a.volume = volume;
  return a;
}

function playSound(audio: HTMLAudioElement) {
  audio.currentTime = 0;
  void audio.play().catch(() => {
    // Ignore autoplay policy/gesture timing rejections.
  });
}

export function useGameAudio(state: GameState, latestSlashMs: number | null) {
  const soundsRef = React.useRef<Record<SoundKey, HTMLAudioElement> | null>(null);
  const prevRef = React.useRef<GameState | null>(null);
  const lastPlayedSlashMsRef = React.useRef(0);

  React.useEffect(() => {
    if (soundsRef.current) return;
    soundsRef.current = {
      swipe: createAudio("/assets/fruit-ninja/sounds/swipe.wav", 0.35),
      sliceHit: createAudio("/assets/fruit-ninja/sounds/slice-hit.wav", 0.55),
      miss: createAudio("/assets/fruit-ninja/sounds/miss.wav", 0.45),
      gameOver: createAudio("/assets/fruit-ninja/sounds/game-over.wav", 0.6),
    };
  }, []);

  React.useEffect(() => {
    const sounds = soundsRef.current;
    if (!sounds) return;

    if (latestSlashMs && latestSlashMs > lastPlayedSlashMsRef.current) {
      lastPlayedSlashMsRef.current = latestSlashMs;
      playSound(sounds.swipe);
    }
  }, [latestSlashMs]);

  React.useEffect(() => {
    const sounds = soundsRef.current;
    if (!sounds) return;

    const prev = prevRef.current;
    if (!prev) {
      prevRef.current = state;
      return;
    }

    if (state.score > prev.score) {
      playSound(sounds.sliceHit);
    }

    if (state.lives < prev.lives) {
      playSound(sounds.miss);
    }

    if (prev.phase !== "gameOver" && state.phase === "gameOver") {
      playSound(sounds.gameOver);
    }

    prevRef.current = state;
  }, [state]);
}

