"use client";
import { FLOWER_PHOTOS } from "@/components/three/engine/assets";

/**
 * Katta gul qatlami — haqiqiy gul suratlari (public/flowers/textures/, webp),
 * har biri o'z parallaks chuqurligi va chayqalish ritmi bilan.
 * Orqada esa xiraroq "barg-soyalar" qatlami turadi (yashilga bo'yalgan,
 * kuchli blur) — chuqurlik hissi uchun.
 * Ranglar/xiralik mavzu tokenlaridan: --flower-dim, --foliage-op, --flower-glow.
 */

const FLOWERS = [
  { src: FLOWER_PHOTOS.peony, cls: "right-[-46px] top-[10%] w-[330px] animate-sway origin-bottom", depth: 5, op: 0.5, dur: "17s" },
  { src: FLOWER_PHOTOS.hydrangeaPink, cls: "bottom-[-52px] left-[20%] w-[320px] animate-sway origin-bottom", depth: 6, op: 0.52, dur: "19s" },
  { src: FLOWER_PHOTOS.hydrangeaWhite, cls: "bottom-[-48px] left-[47%] w-[260px] animate-sway origin-bottom", depth: 4, op: 0.46, dur: "21s" },
  { src: FLOWER_PHOTOS.hydrangeaBlue, cls: "bottom-[-38px] right-[5%] w-[290px] animate-sway origin-bottom", depth: 7, op: 0.48, dur: "23s" },
];

const FOLIAGE = [
  { src: FLOWER_PHOTOS.hydrangeaWhite, cls: "left-[-90px] top-[18%] w-[380px]", depth: 2 },
  { src: FLOWER_PHOTOS.hydrangeaPink, cls: "right-[22%] top-[-110px] w-[420px] rotate-[160deg]", depth: 1.4 },
];

export default function BackgroundFlowers() {
  return (
    <>
      {/* barg-soyalar — uzoq qatlam */}
      {FOLIAGE.map((f, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={`fol-${i}`}
          src={f.src}
          alt=""
          loading="lazy"
          decoding="async"
          className={`theme-fade absolute ${f.cls}`}
          style={{
            opacity: "var(--foliage-op)",
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={f.src}
            alt=""
            loading="lazy"
            decoding="async"
            className={`theme-fade absolute ${f.cls}`}
            style={{
              opacity: `calc(${f.op} * var(--flower-dim))`,
              animationDuration: f.dur,
              filter: "drop-shadow(0 18px 42px var(--flower-glow))",
            }}
          />
        </div>
      ))}
    </>
  );
}
