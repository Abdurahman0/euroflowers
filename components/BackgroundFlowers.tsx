"use client";
import { useTheme } from "@/lib/store";
import { FLOWER_PHOTOS } from "@/components/three/engine/assets";

/**
 * Katta gul qatlami — haqiqiy gul suratlari (public/flowers/textures/),
 * har biri o'z parallaks chuqurligi va chayqalish ritmi bilan.
 * Orqada esa xiraroq "barg-soyalar" qatlami turadi (yashilga bo'yalgan,
 * kuchli blur) — chuqurlik hissi uchun.
 */

const FLOWERS = [
  { src: FLOWER_PHOTOS.peony, cls: "right-[-46px] top-[10%] w-[330px] animate-sway origin-bottom", depth: 5, op: [0.5, 0.36], dur: "17s" },
  { src: FLOWER_PHOTOS.hydrangeaPink, cls: "bottom-[-52px] left-[20%] w-[320px] animate-sway origin-bottom", depth: 6, op: [0.52, 0.38], dur: "19s" },
  { src: FLOWER_PHOTOS.hydrangeaWhite, cls: "bottom-[-48px] left-[47%] w-[260px] animate-sway origin-bottom", depth: 4, op: [0.46, 0.32], dur: "21s" },
  { src: FLOWER_PHOTOS.hydrangeaBlue, cls: "bottom-[-38px] right-[5%] w-[290px] animate-sway origin-bottom", depth: 7, op: [0.48, 0.34], dur: "23s" },
];

const FOLIAGE = [
  { src: FLOWER_PHOTOS.hydrangeaWhite, cls: "left-[-90px] top-[18%] w-[380px]", depth: 2 },
  { src: FLOWER_PHOTOS.hydrangeaPink, cls: "right-[22%] top-[-110px] w-[420px] rotate-[160deg]", depth: 1.4 },
];

export default function BackgroundFlowers() {
  const { dark } = useTheme();
  const glow = { filter: `drop-shadow(0 18px 42px rgba(120,70,60,${dark ? 0.35 : 0.22}))` };

  return (
    <>
      {/* barg-soyalar — uzoq qatlam */}
      {FOLIAGE.map((f, i) => (
        <img
          key={`fol-${i}`}
          src={f.src}
          alt=""
          className={`absolute ${f.cls}`}
          style={{
            opacity: dark ? 0.1 : 0.16,
            filter: "blur(26px) hue-rotate(75deg) saturate(0.55) brightness(0.72)",
            transform: `translate3d(calc(var(--plx-x, 0px) * ${f.depth}), calc(var(--plx-y, 0px) * ${f.depth}), 0)`,
            willChange: "transform",
          }}
        />
      ))}
      {/* haqiqiy gullar — yaqin qatlam, har biri o'z chuqurligida */}
      {FLOWERS.map((f, i) => (
        <div
          key={i}
          className="pointer-events-none absolute inset-0"
          style={{
            transform: `translate3d(calc(var(--plx-x, 0px) * ${f.depth}), calc(var(--plx-y, 0px) * ${f.depth}), 0)`,
            willChange: "transform",
          }}
        >
          <img
            src={f.src}
            alt=""
            className={`absolute ${f.cls}`}
            style={{ opacity: dark ? f.op[1] : f.op[0], animationDuration: f.dur, ...glow }}
          />
        </div>
      ))}
    </>
  );
}
