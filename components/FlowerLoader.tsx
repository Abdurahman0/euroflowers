"use client";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useWebGL } from "@/lib/webgl";
import { ENABLE_3D } from "@/lib/flags";

const LoadingFlower = dynamic(() => import("./three/LoadingFlower"), {
  ssr: false,
  // GLB hali yo'lda — yumshoq nafas oluvchi nur (spinner emas)
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <span
        className="block h-16 w-16 rounded-full blur-xl"
        style={{ background: "var(--accL)", animation: "glowPulse 2.6s ease-in-out infinite" }}
      />
    </div>
  ),
});

/**
 * Yuklanish holati: Blender piyoni g'uncha → gullash siklini ijro etadi.
 *
 * MUHIM (sahifa almashish tezligi): loader 250ms KECHIKIB chiqadi.
 * Tez keladigan sahifalarda 3D canvas umuman mount bo'lmaydi —
 * navigatsiya lagining asosiy manbai shu edi. Sekin yuklanishlarda
 * ko'rinish avvalgidek qoladi.
 */
export default function FlowerLoader({ label = "Yuklanmoqda…" }: { label?: string }) {
  const glOk = useWebGL();
  const [show, setShow] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShow(true), 250);
    return () => clearTimeout(t);
  }, []);

  if (!show) return null;

  return (
    <div className="mt-8 flex flex-col items-center gap-1" role="status" aria-label={label}>
      <div className="flex h-[210px] w-[190px] items-center justify-center">
        {ENABLE_3D && glOk ? (
          <LoadingFlower />
        ) : (
          // GPU yo'q — nafas oluvchi nur bilan kifoyalanamiz
          <span
            className="block h-16 w-16 rounded-full blur-xl"
            style={{ background: "var(--accL)", animation: "glowPulse 2.6s ease-in-out infinite" }}
          />
        )}
      </div>
      <span className="text-[13px] font-medium" style={{ color: "var(--mut)" }}>{label}</span>
    </div>
  );
}
