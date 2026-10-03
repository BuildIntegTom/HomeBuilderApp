"use client";

import { useCallback, useRef } from "react";

/**
 * Synthesizes a two-part mechanical "click-clack" (Tommy: "a light switch
 * sound when you switch the metric and imperial switch") via the Web Audio
 * API — no external audio asset to source/license, and it works the first
 * time a user clicks (the `AudioContext` is created lazily on that same
 * user gesture, satisfying browsers' autoplay-gesture requirement).
 */
/**
 * ⚠ **MUTED 2026-10-02 AT TOMMY'S REQUEST — TEMPORARY, RESTORE ON HIS WORD.**
 * *"If there are any sound effects or you make any noise can you please make
 * sure everything is muted/sound off until Sunday 11am"* (Sunday = 2026-10-04).
 *
 * This is the app's ONLY audio source — `useRustleSound` went with the view
 * dial on 2026-09-29, and a grep for `AudioContext` / `new Audio` / `.play()`
 * across `apps/web/app` returns this file alone. So returning early here
 * silences the whole app; there is no second place to check.
 *
 * Deliberately a one-line early return rather than a mute setting: he asked
 * for two days of quiet, not a feature. **Delete the two lines below and this
 * block to restore** — the synthesis underneath is untouched and still
 * carries his original "a light switch sound when you switch the metric and
 * imperial switch".
 */
const MUTED_UNTIL_TOMMY_SAYS_OTHERWISE = true;

export function useSwitchSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  return useCallback(() => {
    if (MUTED_UNTIL_TOMMY_SAYS_OTHERWISE) return;
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
