"use client";
import { CalendarDays } from "lucide-react";
import { motion } from "framer-motion";
import { useStore } from "@/lib/store";
import type { DateFilter } from "@/lib/types";

/**
 * Davr tanlagich — segmentli boshqaruv: sirg'aluvchi aksent "thumb"
 * (framer layoutId) + tanlangan davrning HAQIQIY sanalari o'ng tomonda
 * ko'rsatiladi ("20-iyn — 19-iyl"). CRM va Sklad bir xil ishlatadi.
 */

const OPTS: [DateFilter, string, number][] = [
  ["bugun", "Bugun", 0],
  ["hafta", "7 kun", 6],
  ["oy", "30 kun", 29],
];
const MONTHS = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
const fmtD = (d: Date) => `${d.getDate()}-${MONTHS[d.getMonth()]}`;

export default function DateChips() {
  const { dateFilter, setDateFilter } = useStore();
  const days = OPTS.find(([id]) => id === dateFilter)?.[2] ?? 29;
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - days);
  const range = days === 0 ? fmtD(now) : `${fmtD(from)} — ${fmtD(now)}`;

  return (
    <div className="bg-sfc flex items-center rounded-full border p-1" style={{ borderColor: "var(--border)" }}>
      <span className="pl-2.5 pr-1.5" style={{ color: "var(--muted)" }} aria-hidden>
        <CalendarDays size={15} strokeWidth={1.75} />
      </span>
      {OPTS.map(([id, label]) => {
        const active = dateFilter === id;
        return (
          <button
            key={id}
            onClick={() => setDateFilter(id)}
            aria-pressed={active}
            className="relative rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors duration-200"
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
      {/* tanlangan davrning aniq sanalari */}
      <span
        suppressHydrationWarning
        className="ml-1 hidden items-center border-l py-0.5 pl-3 pr-3.5 text-[12px] font-medium tabular-nums sm:flex"
        style={{ borderColor: "var(--line2)", color: "var(--text-2)" }}
      >
        {range}
      </span>
    </div>
  );
}
