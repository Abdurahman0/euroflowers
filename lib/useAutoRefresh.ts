"use client";
import { useEffect, useRef } from "react";

/**
 * Sahifa ma'lumotlarini "real vaqt" his qildiruvchi jimgina yangilash:
 *   • har intervalMs (standart 20s) — faqat varaq ko'rinib turganda
 *   • varaqqa qaytilganda (focus/visibilitychange) darhol
 * reload sifatida sahifaning odatiy load() funksiyasi beriladi — u loading
 * flagini qayta ko'tarmagani uchun yangilanish ekranni "lip-lip" qildirmaydi.
 */
export default function useAutoRefresh(reload: () => void, intervalMs = 20000) {
  const ref = useRef(reload);
  ref.current = reload;

  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    const id = setInterval(tick, intervalMs);
    const onVisible = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    window.addEventListener("focus", onVisible);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onVisible);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
}
