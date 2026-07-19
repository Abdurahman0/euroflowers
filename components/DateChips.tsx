"use client";
import { CalendarDays, CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import type { DateFilter, DateRange } from "@/lib/types";

/**
 * Davr tanlagich — segmentli boshqaruv (Bugun/7/30, sirg'aluvchi thumb) +
 * MAXSUS ORALIQ: kalendar popover'da boshlanish/tugash kunlari tanlanadi.
 * Tanlangan davrning haqiqiy sanalari o'ng tomonda ko'rsatiladi.
 * Maxsus oraliq store'da (dateRange) — CRM va Sklad avtomatik hurmat qiladi;
 * segment bosilsa oraliq bekor bo'ladi (store shunday qiladi).
 */

const OPTS: [DateFilter, string, number][] = [
  ["bugun", "Bugun", 0],
  ["hafta", "7 kun", 6],
  ["oy", "30 kun", 29],
];
const MONTHS_S = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
const MONTHS_F = ["Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun", "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr"];
const WEEKDAYS = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const fmtShort = (s: string) => {
  const d = new Date(s + "T00:00:00");
  return `${d.getDate()}-${MONTHS_S[d.getMonth()]}`;
};

function RangeCalendar({ initial, onApply, onClose }: { initial: DateRange | null; onApply: (r: DateRange) => void; onClose: () => void }) {
  const todayS = ymd(new Date());
  const [cursor, setCursor] = useState(() => {
    const d = initial ? new Date(initial.from + "T00:00:00") : new Date();
    d.setDate(1);
    return d;
  });
  const [start, setStart] = useState<string | null>(initial?.from ?? null);
  const [end, setEnd] = useState<string | null>(initial?.to ?? null);

  const y = cursor.getFullYear();
  const m = cursor.getMonth();
  const firstOffset = (new Date(y, m, 1).getDay() + 6) % 7; // Dushanba = 0
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  const pick = (day: string) => {
    if (day > todayS) return;
    if (!start || (start && end)) {
      setStart(day);
      setEnd(null);
    } else if (day < start) {
      setStart(day);
    } else {
      setEnd(day);
    }
  };

  const inRange = (day: string) => start && end && day > start && day < end;

  return (
    <div
      data-lenis-prevent
      className="z-40 rounded-[16px] border p-3 shadow-lg max-md:fixed max-md:inset-x-4 max-md:top-1/2 max-md:mx-auto max-md:w-[min(320px,calc(100vw-32px))] max-md:-translate-y-1/2 md:absolute md:right-0 md:top-[calc(100%+8px)] md:w-[292px]"
      style={{ background: "var(--surface-solid)", borderColor: "var(--border)", boxShadow: "var(--shadow-md)" }}
      role="dialog"
      aria-label="Sana oralig'ini tanlash"
    >
      {/* oy navigatsiyasi */}
      <div className="mb-2 flex items-center justify-between">
        <button type="button" onClick={() => setCursor(new Date(y, m - 1, 1))} className="icon-btn !h-8 !w-8" aria-label="Oldingi oy">
          <ChevronLeft size={16} strokeWidth={1.75} />
        </button>
        <span className="text-[13px] font-semibold">{MONTHS_F[m]} {y}</span>
        <button type="button" onClick={() => setCursor(new Date(y, m + 1, 1))} className="icon-btn !h-8 !w-8" aria-label="Keyingi oy">
          <ChevronRight size={16} strokeWidth={1.75} />
        </button>
      </div>

      {/* hafta kunlari */}
      <div className="grid grid-cols-7 gap-y-1 text-center">
        {WEEKDAYS.map((w) => (
          <span key={w} className="pb-1 text-[10.5px] font-semibold uppercase" style={{ color: "var(--muted)" }}>{w}</span>
        ))}
        {Array.from({ length: firstOffset }).map((_, i) => <span key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = ymd(new Date(y, m, i + 1));
          const isSel = day === start || day === end;
          const future = day > todayS;
          return (
            <button
              key={day}
              type="button"
              disabled={future}
              onClick={() => pick(day)}
              className={clsx(
                "mx-auto flex h-8 w-8 items-center justify-center rounded-full text-[12.5px] font-medium transition-colors duration-150",
                future ? "cursor-not-allowed opacity-30" : "hover:bg-[var(--hover)]",
                inRange(day) && "!rounded-[8px] bg-[color:var(--primary-soft)]",
                isSel && "text-white"
              )}
              style={isSel ? { background: "linear-gradient(135deg, var(--primary), var(--primary-strong))" } : day === todayS ? { boxShadow: "inset 0 0 0 1.5px var(--primary)" } : undefined}
              aria-pressed={isSel}
            >
              {i + 1}
            </button>
          );
        })}
      </div>

      {/* tanlov holati + amallar */}
      <div className="mt-2.5 flex items-center justify-between border-t pt-2.5" style={{ borderColor: "var(--line2)" }}>
        <span className="text-[12px] font-medium" style={{ color: "var(--text-2)" }}>
          {start ? `${fmtShort(start)} — ${end ? fmtShort(end) : "…"}` : "Kunlarni tanlang"}
        </span>
        <span className="flex gap-1.5">
          <button type="button" onClick={onClose} className="chip !h-8 px-3 !text-[12px]">Bekor</button>
          <button
            type="button"
            disabled={!start}
            onClick={() => start && onApply({ from: start, to: end ?? start })}
            className="chip chip-active !h-8 px-3 !text-[12px] disabled:opacity-50"
          >
            Qo&apos;llash
          </button>
        </span>
      </div>
    </div>
  );
}

export default function DateChips() {
  const { dateFilter, setDateFilter, dateRange, setDateRange } = useStore();
  const [calOpen, setCalOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!calOpen) return;
    const close = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setCalOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCalOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [calOpen]);

  const days = OPTS.find(([id]) => id === dateFilter)?.[2] ?? 29;
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - days);
  const range = dateRange
    ? dateRange.from === dateRange.to
      ? fmtShort(dateRange.from)
      : `${fmtShort(dateRange.from)} — ${fmtShort(dateRange.to)}`
    : days === 0
      ? fmtShort(ymd(now))
      : `${fmtShort(ymd(from))} — ${fmtShort(ymd(now))}`;

  return (
    <div ref={rootRef} className="bg-sfc relative flex items-center rounded-full border p-1" style={{ borderColor: "var(--border)" }}>
      <span className="pl-2 pr-1 sm:pl-2.5 sm:pr-1.5" style={{ color: "var(--muted)" }} aria-hidden>
        <CalendarDays size={15} strokeWidth={1.75} />
      </span>
      {OPTS.map(([id, label]) => {
        const active = !dateRange && dateFilter === id;
        return (
          <button
            key={id}
            onClick={() => { setDateFilter(id); setCalOpen(false); }}
            aria-pressed={active}
            className="relative rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition-colors duration-200 sm:px-3.5"
            style={{ color: active ? "#fff" : "var(--muted)" }}
          >
            {active && (
              <motion.span
                layoutId="date-thumb"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
                className="absolute inset-0 rounded-full"
                style={{
                  background: "linear-gradient(135deg, var(--primary), var(--primary-strong))",
                  boxShadow: "var(--shadow-xs), inset 0 1px 0 rgba(255,255,255,0.2)",
                }}
              />
            )}
            <span className="relative z-10">{label}</span>
          </button>
        );
      })}
      {/* maxsus oraliq — kalendar */}
      <button
        onClick={() => setCalOpen((v) => !v)}
        aria-label="Maxsus sana oralig'i"
        aria-expanded={calOpen}
        title="Maxsus oraliq"
        className="relative flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition-colors duration-200 sm:px-3"
        style={dateRange ? { background: "linear-gradient(135deg, var(--primary), var(--primary-strong))", color: "#fff", boxShadow: "var(--shadow-xs), inset 0 1px 0 rgba(255,255,255,0.2)" } : { color: "var(--muted)" }}
      >
        <CalendarRange size={14} strokeWidth={1.75} />
        <span className="hidden min-[420px]:inline">Oraliq</span>
      </button>
      {/* tanlangan davrning aniq sanalari */}
      <span
        suppressHydrationWarning
        className="ml-1 hidden items-center border-l py-0.5 pl-3 pr-3.5 text-[12px] font-medium tabular-nums sm:flex"
        style={{ borderColor: "var(--line2)", color: "var(--text-2)" }}
      >
        {range}
      </span>

      {calOpen && (
        <RangeCalendar
          initial={dateRange}
          onApply={(r) => { setDateRange(r); setCalOpen(false); }}
          onClose={() => setCalOpen(false)}
        />
      )}
    </div>
  );
}
