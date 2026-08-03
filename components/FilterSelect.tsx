"use client";
import { Check, Filter } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Yagona filtr tugmasi — uzun chip qatorlari o'rniga bitta ixcham dropdown.
 * Standart qiymatda neytral "chip", tanlov faolligida aksentga yonadi.
 * Tashqariga bosish / ESC yopadi; Lenis'dan himoyalangan.
 */
export default function FilterSelect({
  value,
  options,
  onChange,
  label = "Filtr",
  align = "right",
  searchable = false,
}: {
  value: string;
  options: { value: string; label: string; sub?: string }[];
  onChange: (v: string) => void;
  /** tugmadagi yozuv — hech narsa tanlanmaganda */
  label?: string;
  align?: "left" | "right";
  /** ⚠️ OPT-IN qidiruv — uzun ro'yxatlar uchun (masalan 33 ta gul navi). Mavjud
      chaqiruvlar o'zgarmaydi; yangi uchinchi uslub kiritilmaydi. */
  searchable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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
  useEffect(() => { if (!open) setQ(""); }, [open]);

  const sel = options.find((o) => o.value === value);
  const active = value !== "";
  const needle = q.trim().toLowerCase();
  const shown = needle
    ? options.filter((o) => !o.value || `${o.label} ${o.sub ?? ""}`.toLowerCase().includes(needle))
    : options;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`chip gap-1.5 ${active ? "chip-active" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <Filter size={14} strokeWidth={1.75} />
        {active && sel ? sel.label : label}
      </button>
      {open && (
        <div
          data-lenis-prevent
          role="listbox"
          className={`absolute top-[calc(100%+6px)] z-30 min-w-[190px] overflow-hidden rounded-[14px] border py-1 shadow-lg ${align === "right" ? "right-0" : "left-0"}`}
          style={{ background: "var(--surface-solid)", borderColor: "var(--border)", boxShadow: "var(--shadow-md)" }}
        >
          {searchable && (
            <div className="px-2 pb-1 pt-0.5">
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Qidirish…"
                aria-label="Ro'yxatdan qidirish"
                className="inp !h-8 !text-[12.5px]"
              />
            </div>
          )}
          <div className={searchable ? "max-h-64 overflow-y-auto thin-scroll" : undefined}>
          {shown.length === 0 && <p className="px-3.5 py-2.5 text-[12.5px]" style={{ color: "var(--muted)" }}>Topilmadi</p>}
          {shown.map((o) => (
            <button
              key={o.value || "all"}
              type="button"
              role="option"
              aria-selected={o.value === value}
              onClick={() => { onChange(o.value); setOpen(false); }}
              className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors duration-150 hover:bg-[var(--hover)]"
              style={{ color: o.value === value ? "var(--primary)" : "var(--text)" }}
            >
              <span className="min-w-0">
                <span className="block truncate">{o.label}</span>
                {o.sub && <span className="block truncate text-[11px]" style={{ color: "var(--muted)" }}>{o.sub}</span>}
              </span>
              {o.value === value && <Check size={14} strokeWidth={2} className="shrink-0" />}
            </button>
          ))}
          </div>
        </div>
      )}
    </div>
  );
}
