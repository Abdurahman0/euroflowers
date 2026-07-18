"use client";
import { Volume2, VolumeX } from "lucide-react";
import { useStore } from "@/lib/store";
import { gardenRef, fadeVolume } from "@/lib/garden";

/**
 * Muhit tovushi tugmasi — frosted-glass chip.
 * Sukutda DOIM mute (brauzer siyosati + odob); bosilганда 0 → volume
 * bo'ylab 1.5s fade. Tanlov store'da — sahifalar aro saqlanadi,
 * yangi yuklashda yana mute.
 */
export default function SoundToggle({
  targetRef,
  volume = 0.25,
  className = "",
}: {
  /** berilmasa — global bog' videosi */
  targetRef?: { el: HTMLVideoElement | null } | { current: HTMLVideoElement | null };
  volume?: number;
  className?: string;
}) {
  const soundOn = useStore((s) => s.soundOn);
  const setSoundOn = useStore((s) => s.setSoundOn);

  const getEl = (): HTMLVideoElement | null => {
    const t = targetRef ?? gardenRef;
    return "el" in t ? t.el : t.current;
  };

  const toggle = () => {
    const el = getEl();
    if (!el) return;
    if (!soundOn) {
      el.muted = false;
      el.volume = 0;
      fadeVolume(el, volume, 1500);
      setSoundOn(true);
    } else {
      fadeVolume(el, 0, 900, () => { el.muted = true; });
      setSoundOn(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      title={soundOn ? "Tovushni o'chirish" : "Tovushni yoqish"}
      aria-label={soundOn ? "Tovushni o'chirish" : "Tovushni yoqish"}
      aria-pressed={soundOn}
      className={`flex h-9 w-9 items-center justify-center rounded-full border backdrop-blur-xl transition-all duration-300 hover:scale-105 ${className}`}
      style={{
        background: "color-mix(in srgb, var(--bg) 55%, transparent)",
        borderColor: "var(--line, rgba(120,100,90,.25))",
        color: soundOn ? "var(--acc)" : "var(--mut)",
        boxShadow: "0 6px 18px rgba(60,40,30,.14)",
      }}
    >
      {soundOn ? <Volume2 size={16} strokeWidth={1.75} /> : <VolumeX size={16} strokeWidth={1.75} />}
    </button>
  );
}
