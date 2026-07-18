"use client";

/**
 * Fon bog' videosining yagona ro'yxati — SoundToggle shu orqali video
 * elementiga yetadi (store'da DOM saqlamaymiz).
 */
export const gardenRef: { el: HTMLVideoElement | null } = { el: null };

/** Ovoz balandligini silliq o'zgartirish (rAF, ~1.5s). */
export function fadeVolume(el: HTMLVideoElement, to: number, ms = 1500, onDone?: () => void) {
  const from = el.volume;
  const start = performance.now();
  const tick = (now: number) => {
    const t = Math.min((now - start) / ms, 1);
    el.volume = from + (to - from) * (t * (2 - t)); // easeOutQuad
    if (t < 1) requestAnimationFrame(tick);
    else onDone?.();
  };
  requestAnimationFrame(tick);
}
