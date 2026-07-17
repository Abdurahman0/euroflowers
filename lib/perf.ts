"use client";

/**
 * Kuchsiz qurilma aniqlagichi — bezak zichligini moslashtirish uchun.
 * Xotira ≤4GB yoki ≤4 yadro: gulbarg sonlari avvalgi yengil qiymatlarga
 * tushadi (funksiya o'chmaydi, faqat zichlik kamayadi).
 */
export function isLowEnd(): boolean {
  if (typeof navigator === "undefined") return false;
  const n = navigator as Navigator & { deviceMemory?: number };
  if (n.deviceMemory !== undefined && n.deviceMemory <= 4) return true;
  if (n.hardwareConcurrency !== undefined && n.hardwareConcurrency <= 4) return true;
  return false;
}
