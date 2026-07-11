"use client";

import { useCallback, useRef } from "react";

/**
 * Synthesizes a short "rustling bush" burst (Tommy: "a brushling bush sound
 * when you toggle 2d to three d and back") via the Web Audio API — filtered
 * white noise with a quick decay, no external audio asset needed (same
 * lazy-AudioContext approach as useSwitchSound.ts).
 */
export function useRustleSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  return useCallback(() => {
    if (typeof window === "undefined") return;
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return;

    if (!ctxRef.current) ctxRef.current = new AudioContextCtor();
    const ctx = ctxRef.current;
    if (ctx.state === "suspended") void ctx.resume();

    const durationSec = 0.35;
    const sampleCount = Math.floor(ctx.sampleRate * durationSec);
    const buffer = ctx.createBuffer(1, sampleCount, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < sampleCount; i++) {
      // White noise, amplitude-shaped into a few quick rustling "taps"
      // rather than one smooth swell, so it reads as leaves/straw rather
      // than wind.
      const t = i / sampleCount;
      const taps = Math.abs(Math.sin(t * Math.PI * 7));
      data[i] = (Math.random() * 2 - 1) * taps * (1 - t);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 2500;
    bandpass.Q.value = 0.7;

    const gain = ctx.createGain();
    gain.gain.value = 0.35;

    source.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(ctx.destination);
    source.start();
  }, []);
}
