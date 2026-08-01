"use client";
import clsx from "clsx";

/**
 * DONA / POCHKA segment toggle + miqdor kiritish.
 * Pochka rejimida jonli "6 pochka × 25 = 150 dona" preview ko'rsatadi.
 * Ota komponent qaysi rejim (mode) va qiymatni (value) boshqaradi — API'ga
 * FAQAT bittasi yuboriladi (dona YOKI pochka), hech qachon ikkalasi.
 */
export type QtyMode = "stems" | "bunches";

export default function DualQtyInput({
  mode,
  value,
  stemsPerBunch,
  onMode,
  onValue,
  label = "Miqdor",
  autoFocus,
}: {
  mode: QtyMode;
  value: string;
  stemsPerBunch: number;
  onMode: (m: QtyMode) => void;
  onValue: (v: string) => void;
  label?: string;
  autoFocus?: boolean;
}) {
  const spb = stemsPerBunch > 0 ? stemsPerBunch : 1;
  const num = parseFloat(value) || 0;
  const computedStems = mode === "bunches" ? Math.round(num * spb) : num;
  // rejim almashganda QIYMAT qayta HISOBLANADI (qayta talqin EMAS): 100 pochka → dona = 2 500
  const switchMode = (m: QtyMode) => { if (m !== mode) onValue(convertQty(value, mode, m, spb)); onMode(m); };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>{label}</span>
        <div className="bg-sfc flex items-center rounded-full border p-0.5" style={{ borderColor: "var(--border)" }} role="tablist">
          {(["stems", "bunches"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              aria-pressed={mode === m}
              className={clsx("rounded-full px-3 py-1 text-[11.5px] font-bold transition-colors duration-150", mode === m ? "text-white" : "")}
              style={mode === m ? { background: "var(--primary)" } : { color: "var(--muted)" }}
            >
              {m === "stems" ? "Dona" : "Pochka"}
            </button>
          ))}
        </div>
      </div>
      <input
        className="inp"
        inputMode="decimal"
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onValue(e.target.value.replace(/[^\d.]/g, ""))}
        placeholder={mode === "stems" ? "Masalan: 150" : "Masalan: 6"}
      />
      {/* ⚠️ POCHKA rejimda kiritilgan son DONAGA nimani anglatishini IMPOSSIBLE-TO-MISS ko'rsatamiz
          (default pochka bo'lgani uchun "100" endi 2 500 dona degani). */}
      {mode === "bunches" && num > 0 && (
        <span className="flex w-fit items-center gap-1 rounded-[9px] px-2.5 py-1 text-[12.5px] font-bold" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>
          {value} pochka = {computedStems.toLocaleString("ru")} dona
        </span>
      )}
    </div>
  );
}

/** Ochilishdagi DEFAULT birlik: pochka MA'NOLI bo'lsa (spb > 1) pochka, aks holda dona.
    Materiallarda / spb yo'q partiyalarda pochka ma'nosiz → dona'ga tushamiz. */
export const defaultQtyMode = (stemsPerBunch: number | null | undefined): QtyMode =>
  (stemsPerBunch ?? 0) > 1 ? "bunches" : "stems";

/** Bir birlikdan ikkinchisiga QIYMATNI qayta hisoblaydi (rejim almashganda). stems↔bunches.
    Bir xil rejim yoki bo'sh qiymat → o'zgarmaydi. bunches→stems butun; stems→bunches 2 xona. */
export function convertQty(value: string, from: QtyMode, to: QtyMode, stemsPerBunch: number): string {
  if (from === to || !value) return value;
  const n = parseFloat(value);
  if (Number.isNaN(n)) return value;
  const spb = stemsPerBunch > 0 ? stemsPerBunch : 1;
  return to === "stems" ? String(Math.round(n * spb)) : String(+(n / spb).toFixed(2));
}

/** Rejim + qiymatdan API payloadini yasaydi (faqat bittasi). */
export function qtyPayload(mode: QtyMode, value: string): { quantity_stems?: number } | { quantity_bunches: string } {
  const num = parseFloat(value) || 0;
  return mode === "bunches" ? { quantity_bunches: num.toFixed(2) } : { quantity_stems: Math.round(num) };
}
