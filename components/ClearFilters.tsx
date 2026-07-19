"use client";
import { FilterX } from "lucide-react";

/**
 * Filtrlarni tozalash tugmasi — faqat biror filtr faol bo'lganda ko'rinadi.
 * Har bir sahifa o'z "faol" shartini va tozalash amalini o'zi beradi.
 */
export default function ClearFilters({ show, onClear }: { show: boolean; onClear: () => void }) {
  if (!show) return null;
  return (
    <button
      type="button"
      onClick={onClear}
      title="Filtrlarni tozalash"
      aria-label="Filtrlarni tozalash"
      className="chip gap-1.5 animate-[rowIn_0.18s_var(--ease)_both] hover:!bg-[color:var(--danger-soft)]"
      style={{ color: "var(--danger-ink)", borderColor: "color-mix(in srgb, var(--danger) 30%, transparent)" }}
    >
      <FilterX size={14} strokeWidth={1.75} /> Tozalash
    </button>
  );
}
