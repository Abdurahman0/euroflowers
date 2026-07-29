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

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>{label}</span>
        <div className="bg-sfc flex items-center rounded-full border p-0.5" style={{ borderColor: "var(--border)" }} role="tablist">
          {(["stems", "bunches"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onMode(m)}
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
      {mode === "bunches" && num > 0 && (
        <span className="text-[12px] font-semibold" style={{ color: "var(--primary)" }}>
          {value} pochka × {spb} = {computedStems} dona
        </span>
      )}
    </div>
  );
}

/** Rejim + qiymatdan API payloadini yasaydi (faqat bittasi). */
export function qtyPayload(mode: QtyMode, value: string): { quantity_stems?: number } | { quantity_bunches: string } {
  const num = parseFloat(value) || 0;
  return mode === "bunches" ? { quantity_bunches: num.toFixed(2) } : { quantity_stems: Math.round(num) };
}
