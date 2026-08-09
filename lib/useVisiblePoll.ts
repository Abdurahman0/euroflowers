"use client";
import { useEffect, useRef } from "react";

/**
 * DAVRIY SO'ROV — FAQAT AI SUHBATI UCHUN va FAQAT VARAQ KO'RINIB TURGANDA.
 *
 * ⚠️ Butun ilovada avtomatik yangilash o'chirilgan. Yagona istisno — operator
 * mijoz bilan yozishayotgan suhbat: u yerda yangi xabarni ko'rmaslik haqiqiy
 * zarar. Shu bois qoidalar QAT'IY:
 *   • `enabled: false` bo'lsa (suhbat tanlanmagan) — taymer UMUMAN yo'q
 *   • varaq yashirilsa — taymer TO'XTAYDI (fonda so'rov ketmaydi)
 *   • varaqqa qaytilganda — bir marta darhol yangilanadi, keyin davom etadi
 *
 * Boshqa hech qayerda ishlatilmasin — sahifa ma'lumoti «Yangilash» tugmasi va
 * mutatsiyadan keyingi notifyReportDataChanged() bilan yangilanadi.
 */
export default function useVisiblePoll(fn: () => void, intervalMs: number, enabled: boolean) {
  const ref = useRef(fn);
  ref.current = fn;

  useEffect(() => {
    if (!enabled || typeof document === "undefined") return;
    let timer: ReturnType<typeof setInterval> | null = null;

    const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
    const start = () => {
      stop();
      timer = setInterval(() => { if (document.visibilityState === "visible") ref.current(); }, intervalMs);
    };

    const onVis = () => {
      if (document.visibilityState === "visible") { ref.current(); start(); }
      else stop();                       // ⚠️ fon — hech qanday so'rov yo'q
    };

    if (document.visibilityState === "visible") start();
    document.addEventListener("visibilitychange", onVis);
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [intervalMs, enabled]);
}
