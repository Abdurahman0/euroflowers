"use client";
import { useEffect, useState } from "react";

/**
 * Juda past opacity + blur bilan real hayot fon videosi.
 * public/videos/garden.webm|mp4 topilmasa umuman render qilinmaydi.
 */
export default function CinematicVideo({ opacity = 0.16, blur = 7 }: { opacity?: number; blur?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    let alive = true;
    (async () => {
      for (const url of ["/videos/garden.webm", "/videos/garden.mp4"]) {
        try {
          const r = await fetch(url, { method: "HEAD" });
          const ct = r.headers.get("content-type") ?? "";
          if (r.ok && !ct.includes("text/html")) {
            if (alive) setSrc(url);
            return;
          }
        } catch { /* keyingisi */ }
      }
    })();
    return () => { alive = false; };
  }, []);

  if (!src || reduced) return null;
  return (
    <video
      autoPlay
      muted
      loop
      playsInline
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      style={{ opacity, filter: `blur(${blur}px) saturate(1.1)` }}
      src={src}
    />
  );
}
