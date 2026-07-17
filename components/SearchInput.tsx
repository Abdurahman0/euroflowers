"use client";
import { Icon } from "@/components/icons";

/**
 * Yagona qidiruv maydoni — barcha sahifa toolbarlarida bitta ko'rinish
 * va bitta fokus xulqi: brauzer konturi YO'Q, pill focus-within'da aksent
 * chegara + yumshoq halqa oladi (globals.css `.search-box`).
 * Yangi qidiruv joyi kerak bo'lsa — shu komponentni ishlating,
 * per-komponent CSS yozmang (regressiya shundan chiqadi).
 */
export default function SearchInput({
  value,
  onChange,
  placeholder = "Qidirish…",
  width = 150,
  ariaLabel,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  /** input kengligi px'da; "full" — konteynerga to'ladi */
  width?: number | "full";
  ariaLabel?: string;
  className?: string;
}) {
  return (
    <div className={`search-box glass flex items-center gap-2 !rounded-[12px] px-3 py-0.5 text-[13px] ${className}`} style={{ color: "var(--muted)" }}>
      <Icon name="search" size={14} />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`bg-transparent py-1.5 outline-none placeholder:text-[color:var(--muted)] ${width === "full" ? "w-full" : ""}`}
        style={{ color: "var(--text)", ...(width === "full" ? {} : { width }) }}
        aria-label={ariaLabel ?? placeholder}
      />
    </div>
  );
}
