"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { ENABLE_3D } from "@/lib/flags";
import { useWebGL } from "@/lib/webgl";
import { useFlowerParallax } from "./useFlowerParallax";

/**
 * Premium piyon — asosiy kontent yuqori-chap dekorativ elementi.
 * Standart: statik surat (tez, hamma uchun bir xil ko'rinish).
 * NEXT_PUBLIC_ENABLE_3D=1 bo'lsa — jonli 3D varianti (PremiumPeony3D)
 * dynamic import bilan yuklanadi; bayroq o'chiq bo'lsa three.js chunki
 * umuman fetch qilinmaydi.
 */

const Peony3D = dynamic(() => import("./PremiumPeony3D"), { ssr: false });

export default function PremiumPeony() {
  const wrapRef = useFlowerParallax<HTMLDivElement>(5);
  const glOk = useWebGL();
  const use3D = ENABLE_3D && glOk;

  return (
    <div
      ref={wrapRef}
      aria-hidden
      className="pointer-events-none absolute left-[218px] top-[7%] h-[clamp(340px,54vh,640px)] w-[clamp(340px,54vh,640px)] opacity-[.8] max-md:left-[36px] max-md:h-[220px] max-md:w-[220px] max-md:opacity-[.45]"
      style={{
        willChange: "transform",
        filter: "blur(0.8px) saturate(1.05)",
        // chetlari fonga erib ketadi — "fonga bosilgan" his, to'rtburchak yo'q
        WebkitMaskImage: "radial-gradient(closest-side, black 52%, transparent 88%)",
        maskImage: "radial-gradient(closest-side, black 52%, transparent 88%)",
      }}
    >
      {use3D ? (
        <Peony3D />
      ) : (
        <Image
          src="/flowers/textures/peony.webp"
          alt=""
          fill
          sizes="(max-width: 768px) 220px, 54vh"
          priority
          className="object-contain"
        />
      )}
    </div>
  );
}
