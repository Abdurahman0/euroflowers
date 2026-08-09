"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * QO'LDA YANGILASH — ⚠️ AVTOMATIK TAYMER YO'Q.
 *
 * ═══ NIMA O'ZGARDI VA NEGA ═══
 * Ilgari bu hook har 20 soniyada sahifaning butun `load()` ini qayta chaqirardi,
 * ustiga `focus` VA `visibilitychange` hodisalariga ham ulangan edi. Oqibati
 * (jonli o'lchov, prod build, foydalanuvchi HECH NARSA qilmay 60 soniya turganda):
 *     /            14 so'rov      /sklad   18 so'rov      /katalog  10 so'rov
 * Katalog 154 qatorli jadvalni daqiqasiga o'n marta qayta tortardi — har ochiq
 * varaq uchun alohida. Alt-tab qilganda esa `focus` va `visibilitychange`
 * IKKALASI ham otilib, `load()` ketma-ket ikki marta ishlardi.
 *
 * Endi ma'lumot FAQAT shu hollarda yangilanadi:
 *   • foydalanuvchi harakati — sahifaga o'tish, filtr/sahifa almashtirish
 *   • «Yangilash» tugmasi (components/RefreshButton.tsx)
 *   • mutatsiyadan keyin — notifyReportDataChanged() (lib/reportCache.ts)
 *   • WebSocket `supplier_stock` push — ataylab qoldirilgan
 *
 * Hook o'zi saqlab qolindi: chaqiruvchilar interfeysi buzilmasin va yangilash
 * mantiqi bitta joyda tursin. U endi FAQAT qo'lda ishga tushadigan funksiya
 * hamda «oxirgi yuklash» vaqtini qaytaradi.
 */
export default function useAutoRefresh(reload: () => void): {
  refresh: () => void;
  loadedAt: number | null;
} {
  const ref = useRef(reload);
  ref.current = reload;
  const [loadedAt, setLoadedAt] = useState<number | null>(null);

  // birinchi montajda «yuklandi» vaqtini belgilaymiz (so'rov YUBORMAYDI)
  useEffect(() => { setLoadedAt(Date.now()); }, []);

  const refresh = useCallback(() => {
    ref.current();
    setLoadedAt(Date.now());
  }, []);

  return { refresh, loadedAt };
}
