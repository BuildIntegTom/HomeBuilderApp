"use client";

import { useCallback, useRef } from "react";

/**
 * Synthesizes a two-part mechanical "click-clack" (Tommy: "a light switch
 * sound when you switch the metric and imperial switch") via the Web Audio
 * API — no external audio asset to source/license, and it works the first
 * time a user clicks (the `AudioContext` is created lazily on that same
 * user gesture, satisfying browsers' autoplay-gesture requirement).
 */
export function useSwitchSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  return useCallback(() => {
    if (typeof window === "undefined") return;
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    if (!ctxRef.current) ctxRef.current = new AudioContextCtor();
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") void ctx.resume();

    const click = (delaySec: number, freqHz: number) => {
      const startAt = ctx.currentTime + delaySec;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freqHz, startAt);
      gain.gain.setValueAtTime(0.22, startAt);
      gain.gain.exponentialRampToValueAtTime(0.001, startAt + 0.025);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startAt);
      osc.stop(startAt + 0.03);
    };

    // A physical toggle switch: a sharp higher "click" as it releases,
    // then a slightly lower "clack" as it seats on the other side.
    click(0, 1900);
    click(0.055, 1300);
  }, []);
}
