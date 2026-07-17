"use client";
import { useEffect, useState } from "react";

let cached: boolean | null = null;

/**
 * Bir martalik WebGL tekshiruvi. GPU o'chirilgan muhitlarda (Linux'da
 * blacklist qilingan drayverlar, virtual mashinalar, ba'zi Vercel preview
 * brauzerlari) THREE kontekst yarata olmay konsolni xatolarga to'ldiradi —
 * bunday holatda 3D qatlamlar umuman mount qilinmasligi kerak.
 */
export function supportsWebGL(): boolean {
  if (cached !== null) return cached;
  if (typeof document === "undefined") return false;
  try {
    const c = document.createElement("canvas");
    cached = !!(c.getContext("webgl2") ?? c.getContext("webgl"));
  } catch {
    cached = false;
  }
  return cached;
}

/** SSR-xavfsiz hook: mountdan keyin haqiqiy qiymatni qaytaradi. */
export function useWebGL(): boolean {
  const [ok, setOk] = useState(false);
  useEffect(() => setOk(supportsWebGL()), []);
  return ok;
}
