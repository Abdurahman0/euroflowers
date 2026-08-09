"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE_OPTIONS, pageNumbers, type PageInfo } from "@/lib/pagination";

/**
 * SAHIFALASH BOSHQARUVI — butun ilova uchun YAGONA komponent.
 *
 * ⚠️ Raqamlar SERVERDAN (`page` / `total_pages` / `has_next` / `has_previous`).
 * Bu yerda hech narsa `count / page_size` dan hisoblanmaydi va `next` havolasi
 * tahlil qilinmaydi — `readPageInfo` allaqachon serverning javobini o'qigan.
 *
 * ⚠️ Bitta sahifadan ikkinchisiga o'tish AYNAN BITTA so'rov yuboradi: bu komponent
 * faqat `onPage(n)` chaqiradi, ma'lumotni o'zi olmaydi.
 */
export default function Pagination({
  info,
  onPage,
  onPageSize,
  label = "yozuv",
  busy = false,
}: {
  info: PageInfo;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  /** «154 ta yozuv» dagi so'z */
  label?: string;
  busy?: boolean;
}) {
  const { page, totalPages, hasNext, hasPrevious, count, from, to } = info;
  // ⚠️ Bitta sahifa va tanlagich kerak bo'lmasa — umuman chizmaymiz (bo'sh panel qolmasin)
  if (totalPages <= 1 && !onPageSize) return null;

  const btn = "flex h-8 min-w-8 items-center justify-center rounded-[10px] border px-2 text-[12.5px] font-bold transition-colors duration-150 disabled:opacity-40";

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
      {/* ⚠️ JAMI — serverning `count`i, ekrandagi qatorlar soni EMAS */}
      <span className="text-[12.5px] tabular-nums" style={{ color: "var(--muted)" }}>
        {count > 0 ? <>{from}–{to} / <b style={{ color: "var(--text-2)" }}>{count.toLocaleString("ru")}</b> {label}</> : `0 ${label}`}
      </span>

      <div className="flex flex-wrap items-center gap-1.5">
        {onPageSize && (
          <select
            value={info.pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            aria-label="Sahifadagi yozuvlar soni"
            className="h-8 rounded-[10px] border bg-transparent px-2 text-[12.5px] font-semibold"
            style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
          >
            {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n} ta</option>)}
          </select>
        )}

        {totalPages > 1 && (
          <>
            <button type="button" className={btn} style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
              onClick={() => onPage(page - 1)} disabled={!hasPrevious || busy} aria-label="Oldingi sahifa">
              <ChevronLeft size={15} strokeWidth={2.2} />
            </button>

            {pageNumbers(page, totalPages).map((n, i) =>
              n === -1 ? (
                <span key={`gap-${i}`} className="px-1 text-[12.5px]" style={{ color: "var(--muted)" }}>…</span>
              ) : (
                <button key={n} type="button" className={btn} onClick={() => onPage(n)} disabled={busy}
                  aria-label={`${n}-sahifa`} aria-current={n === page ? "page" : undefined}
                  style={n === page
                    ? { borderColor: "var(--primary)", background: "var(--primary)", color: "#fff" }
                    : { borderColor: "var(--border)", color: "var(--text-2)" }}>
                  {n}
                </button>
              ))}

            <button type="button" className={btn} style={{ borderColor: "var(--border)", color: "var(--text-2)" }}
              onClick={() => onPage(page + 1)} disabled={!hasNext || busy} aria-label="Keyingi sahifa">
              <ChevronRight size={15} strokeWidth={2.2} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
