"use client";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

/**
 * Qo'lda yasalgan yakka sana tanlagich — RangeCalendar bilan bir xil dizayn
 * (native type="date" o'rniga hamma joyda shu ishlatiladi).
 * disablePast: yetkazish sanasi kabi kelajak sanalar uchun o'tmish yopiladi.
 */

const MONTHS_S = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
const MONTHS_F = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtShort = (s: string) => {
  const d = new Date(s + "T00:00:00");
  return Number.isNaN(d.getTime()) ? s : `${d.getDate()}-${MONTHS_S[d.getMonth()]} ${d.getFullYear()}`;
};

export default function DatePicker({
  value,
  onChange,
  placeholder = "Sana tanlang",
  disablePast = false,
  ariaLabel,
}: {
  value: string; // YYYY-MM-DD yoki ""
  onChange: (v: string) => void;
  placeholder?: string;
  disablePast?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const todayS = ymd(new Date());
  const [cursor, setCursor] = useState(() => {
    const d = value ? new Date(value + "T00:00:00") : new Date();
    d.setDate(1);
    return d;
  });

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const firstOffset = (new Date(y, m, 1).getDay() + 6) % 7; // Dushanba = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel ?? placeholder}
        aria-expanded={open}
        className="inp flex items-center gap-2 text-left normal-case tracking-normal"
      >
        <CalendarDays size={15} strokeWidth={1.75} className="shrink-0" style={{ color: "var(--muted)" }} />
        <span className={clsx("min-w-0 flex-1 truncate text-[13px] font-semibold", !value && "opacity-50 font-normal")}>
          {value ? fmtShort(value) : placeholder}
        </span>
      </button>
      {open && (
        <div
          data-lenis-prevent
          className="absolute left-0 top-[calc(100%+8px)] z-40 w-[272px] rounded-[16px] border p-3 shadow-lg"
          style={{ background: "var(--surface-solid)", borderColor: "var(--border)", boxShadow: "var(--shadow-md)" }}
          role="dialog"
          aria-label="Sana tanlash"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" onClick={() => setCursor(new Date(y, m - 1, 1))} className="icon-btn !h-8 !w-8" aria-label="Oldingi oy">
              <ChevronLeft size={16} strokeWidth={1.75} />
            </button>
            <span className="text-[13px] font-semibold">{MONTHS_F[m]} {y}</span>
            <button type="button" onClick={() => setCursor(new Date(y, m + 1, 1))} className="icon-btn !h-8 !w-8" aria-label="Keyingi oy">
              <ChevronRight size={16} strokeWidth={1.75} />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-y-1 text-center">
            {WEEKDAYS.map((w) => (
              <span key={w} className="pb-1 text-[10.5px] font-semibold uppercase" style={{ color: "var(--muted)" }}>{w}</span>
            ))}
            {Array.from({ length: firstOffset }).map((_, i) => <span key={`e${i}`} />)}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = ymd(new Date(y, m, i + 1));
              const disabled = disablePast && day < todayS;
              const sel = day === value;
              return (
                <button
                  key={day}
                  type="button"
                  disabled={disabled}
                  onClick={() => { onChange(day); setOpen(false); }}
                  className={clsx(
                    "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[12.5px] font-medium transition-colors duration-150",
                    disabled ? "cursor-not-allowed opacity-30" : "hover:bg-[var(--hover)]",
                    sel && "text-white"
                  )}
                  style={sel ? { background: "linear-gradient(135deg, var(--primary), var(--primary-strong))" } : day === todayS ? { boxShadow: "inset 0 0 0 1.5px var(--primary)" } : undefined}
                  aria-pressed={sel}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          {value && (
            <div className="mt-2 border-t pt-2 text-right" style={{ borderColor: "var(--line2)" }}>
              <button type="button" onClick={() => { onChange(""); setOpen(false); }} className="chip !h-8 px-3 !text-[12px]">
                Tozalash
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
