"use client";
import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";

/**
 * QO'LDA YANGILASH — avtomatik so'rovlar o'chirilgani uchun.
 *
 * ⚠️ NEGA KERAK: ilgari har sahifa 20 soniyada o'zini qayta yuklardi. Bu
 * o'chirildi (foydalanuvchi hech narsa qilmayotganda ham so'rov ketardi), lekin
 * shunchaki o'chirib qo'yish ma'lumot ESKIRIB turganini YASHIRARDI. Shu bois
 * yangilash tugmasi VA oxirgi yuklash vaqti KO'RINIB turadi.
 *
 * Mutatsiyadan keyin ro'yxat baribir o'zi yangilanadi (notifyReportDataChanged).
 */
const ago = (ms: number): string => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 45) return "hozir";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} daq oldin`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} soat oldin` : `${Math.round(h / 24)} kun oldin`;
};

export default function RefreshButton({
  onRefresh, loadedAt, busy = false, compact = false,
}: {
  onRefresh: () => void;
  /** oxirgi muvaffaqiyatli yuklash vaqti (Date.now()) */
  loadedAt?: number | null;
  busy?: boolean;
  compact?: boolean;
}) {
  // «hozir» → «2 daq oldin» o'zgarib tursin (bu TAYMER SO'ROV YUBORMAYDI — faqat matn)
  const [, tick] = useState(0);
  useEffect(() => {
    if (!loadedAt) return;
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [loadedAt]);

  return (
    <button
      type="button"
      onClick={onRefresh}
      disabled={busy}
      title={loadedAt ? `Oxirgi yangilanish: ${new Date(loadedAt).toLocaleTimeString("ru")}` : "Yangilash"}
      aria-label="Ma'lumotni yangilash"
      className="flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-[12px] font-bold transition-colors duration-150 hover:bg-[var(--hover)] disabled:opacity-50"
      style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
    >
      <RotateCw size={13} strokeWidth={2.2} className={busy ? "animate-spin" : undefined} />
      {!compact && <span>{loadedAt ? ago(Date.now() - loadedAt) : "Yangilash"}</span>}
    </button>
  );
}
