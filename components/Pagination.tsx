"use client";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
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
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  alwaysShow = false,
  label = "yozuv",
  busy = false,
}: {
  info: PageInfo;
  onPage: (page: number) => void;
  onPageSize?: (size: number) => void;
  pageSizeOptions?: readonly number[];
  /** Show the page status even when a filtered result has only one page. */
  alwaysShow?: boolean;
  /** «154 ta yozuv» dagi so'z */
  label?: string;
  busy?: boolean;
}) {
  const { page, totalPages, hasNext, hasPrevious, count, from, to } = info;
  // ⚠️ Bitta sahifa va tanlagich kerak bo'lmasa — umuman chizmaymiz (bo'sh panel qolmasin)
  if (totalPages <= 1 && !onPageSize && !(alwaysShow && count > 0)) return null;

  const btn = "flex h-9 min-w-9 items-center justify-center rounded-[12px] border px-2 text-[12.5px] font-bold transition-all duration-150 hover:-translate-y-px hover:shadow-sm disabled:pointer-events-none disabled:opacity-35";

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2.5">
      {/* ⚠️ JAMI — serverning `count`i, ekrandagi qatorlar soni EMAS */}
      <span className="text-[12.5px] tabular-nums" style={{ color: "var(--muted)" }}>
        {count > 0 ? <>{from}–{to} / <b style={{ color: "var(--text-2)" }}>{count.toLocaleString("ru")}</b> {label}</> : `0 ${label}`}
      </span>

      <div className="flex flex-wrap items-center gap-2">
        {onPageSize && (
          <label className="relative flex h-9 items-center rounded-[12px] border px-3 transition-colors hover:border-[color:var(--primary)]" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
            <span className="mr-2 text-[11px] font-semibold" style={{ color: "var(--muted)" }}>Ko&apos;rsatish</span>
            <select
              value={info.pageSize}
              onChange={(e) => onPageSize(Number(e.target.value))}
              aria-label="Sahifadagi yozuvlar soni"
              className="appearance-none bg-transparent pr-5 text-[12.5px] font-bold outline-none"
              style={{ color: "var(--text-2)" }}
            >
              {pageSizeOptions.map((n) => <option key={n} value={n}>{n} ta</option>)}
            </select>
            <ChevronDown size={14} strokeWidth={2.3} className="pointer-events-none absolute right-2" style={{ color: "var(--primary)" }} />
          </label>
        )}

        <span className="rounded-[12px] border px-3 py-2 text-[12px] font-bold tabular-nums" style={{ borderColor: "var(--line)", color: "var(--text-2)", background: "var(--surface-2)" }}>
          Sahifa <b style={{ color: "var(--primary)" }}>{page}</b> / {totalPages}
        </span>

        {totalPages > 1 && (
          <>
            <button type="button" className={btn} style={{ borderColor: "var(--border-strong)", color: "var(--primary)" }}
              onClick={() => onPage(page - 1)} disabled={!hasPrevious || busy} aria-label="Oldingi sahifa">
              <ChevronLeft size={18} strokeWidth={2.4} />
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

            <button type="button" className={btn} style={{ borderColor: "var(--border-strong)", color: "var(--primary)" }}
              onClick={() => onPage(page + 1)} disabled={!hasNext || busy} aria-label="Keyingi sahifa">
              <ChevronRight size={18} strokeWidth={2.4} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
