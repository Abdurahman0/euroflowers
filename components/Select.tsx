"use client";
import { ChevronDown } from "lucide-react";
import { useRef, useState } from "react";
import Popover from "./Popover";

export type SelectOption = {
  value: number | string;
  label: string;
  sub?: string;
  /** tanlangandan KEYIN ham trigger'da ko'rinib turadigan qisqa ma'lumot
      (masalan, sklad qoldig'i: "410 dona") */
  hint?: string;
  dot?: string; // rang nuqtasi (hex) — ixtiyoriy
};

/**
 * Qo'lda yasalgan select — modal glass dizayniga mos, native <select> o'rniga.
 * Ro'yxat Popover orqali body'ga portal qilinadi: drawer skrolli uni kesmaydi,
 * pastda joy bo'lmasa tepada ochiladi (o'lcham muammolariga qarshi yagona yo'l).
 */
export default function Select({
  value,
  options,
  onChange,
  placeholder = "Tanlang",
}: {
  value: number | string;
  options: SelectOption[];
  onChange: (v: number | string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const sel = options.find((o) => o.value === value);

  return (
    <div ref={rootRef} className="relative">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="inp flex items-center gap-2 text-left normal-case tracking-normal">
        {sel?.dot && <span className="h-3 w-3 shrink-0 rounded-full border border-[color:var(--border-strong)]" style={{ background: sel.dot }} />}
        <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">
          {sel ? sel.label : <span className="opacity-50">{placeholder}</span>}
        </span>
        {sel?.hint && (
          <span
            className="shrink-0 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold"
            style={{ borderColor: "var(--border)", background: "var(--surface-2)", color: "var(--text-2)" }}
          >
            {sel.hint}
          </span>
        )}
        <span className={`opacity-60 transition-transform duration-200 ${open ? "rotate-180" : ""}`}><ChevronDown size={16} strokeWidth={1.75} /></span>
      </button>
      <Popover
        anchor={rootRef}
        open={open}
        onClose={() => setOpen(false)}
        width="anchor"
        className="max-h-[212px] overflow-y-auto overscroll-contain rounded-[14px] border shadow-2xl"
        style={{ background: "var(--surface-solid)", borderColor: "var(--border)" }}
      >
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            onClick={() => { onChange(o.value); setOpen(false); }}
            className={`flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left normal-case tracking-normal hover:bg-[color:var(--hover)] ${o.value === value ? "bg-[color:var(--primary-soft)]" : ""}`}
          >
            {o.dot && <span className="h-3 w-3 shrink-0 rounded-full border border-[color:var(--border-strong)]" style={{ background: o.dot }} />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{o.label}</span>
              {o.sub && <span className="block truncate text-[11px] text-[color:var(--muted)]">{o.sub}</span>}
            </span>
            {o.value === value && <span className="text-[11px]" style={{ color: "var(--primary)" }}>✓</span>}
          </button>
        ))}
        {options.length === 0 && <p className="px-3.5 py-2.5 text-[12px] text-[color:var(--muted)]">Variant topilmadi</p>}
      </Popover>
    </div>
  );
}
