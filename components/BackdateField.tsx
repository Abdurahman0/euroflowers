"use client";
import { CalendarClock, AlertTriangle } from "lucide-react";
import DatePicker from "./DatePicker";
import { todayTashkent, isBackdated } from "@/lib/backdate";

/**
 * YAGONA SANA AFFORDANSI — «ish qolib ketgan» yozuvni o'tgan kunga qo'yish uchun.
 * Chiqim / qaytarish / katalog / sotuv — HAMMASI shu bitta komponentdan foydalanadi
 * (ilgari har joyda o'z checkbox+DatePicker jufti bor edi — endi bitta).
 *
 * · Sukut bo'yicha YIG'IQ: odatdagi holat bitta bosishda qoladi.
 * · Kalendar yuqori chegarasi BUGUN — kelajak sana tanlab bo'lmaydi.
 * · Vaqt SO'RALMAYDI (lib/backdate.ts: o'tgan kun → 12:00, bugun → hozir; DOIM +05:00).
 * · O'tgan kun tanlansa RETROAKTIV ogohlantirish chiqadi — o'tgan kunlik
 *   hisobotlar (florist kunlik, sklad jurnali, davr filtrlari) o'zgaradi.
 */
export default function BackdateField({
  value,
  onChange,
  open,
  onOpenChange,
  label = "Sana",
  toggleTitle = "Boshqa sana (ish qolib ketgan bo'lsa)",
  /** o'tgan kun tanlanganda ko'rsatiladigan qo'shimcha oqibat matni */
  retroNote,
  /** tahrir rejimi — yig'ish tugmasi ko'rsatilmaydi, maydon doim ochiq */
  always = false,
}: {
  value: string;
  onChange: (v: string) => void;
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  label?: string;
  toggleTitle?: string;
  retroNote?: string;
  always?: boolean;
}) {
  const today = todayTashkent();
  const back = isBackdated(value);
  const shown = always || !!open;

  return (
    <div>
      {!always && (
        <label
          className="flex cursor-pointer items-center justify-between gap-3 rounded-[13px] border px-3.5 py-3"
          style={open ? { borderColor: "var(--primary)", background: "var(--primary-soft)" } : { borderColor: "var(--border)" }}
        >
          <span className="flex min-w-0 items-center gap-2">
            <CalendarClock size={16} strokeWidth={2} style={{ color: open ? "var(--primary)" : "var(--muted)" }} />
            <span className="min-w-0">
              <span className="block text-[13px] font-bold">{toggleTitle}</span>
              <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>
                Belgilanmasa — bugungi kun
              </span>
            </span>
          </span>
          <input
            type="checkbox"
            checked={!!open}
            onChange={(e) => { onOpenChange?.(e.target.checked); if (!e.target.checked) onChange(""); }}
            className="h-4 w-4 shrink-0 accent-[var(--primary)]"
          />
        </label>
      )}

      {shown && (
        <div className={always ? "" : "mt-2"}>
          {always && <div className="mb-1 text-[12px] font-bold" style={{ color: "var(--text-2)" }}>{label}</div>}
          {/* ⚠️ maxDate = BUGUN — kelajak sana tanlanmaydi (backdate.ts ham ikkinchi qatlam) */}
          <DatePicker value={value} onChange={onChange} placeholder={label} ariaLabel={label} maxDate={today} />

          {back && (
            <p className="mt-1.5 flex items-start gap-1.5 rounded-[10px] px-2.5 py-2 text-[11.5px] font-semibold leading-snug"
              style={{ background: "color-mix(in srgb, #b3873a 15%, transparent)", color: "var(--warning-ink, #8a6d1f)" }}>
              <AlertTriangle size={13} strokeWidth={2.3} className="mt-px shrink-0" />
              <span>
                O&apos;tgan kunga yoziladi — <b>o&apos;sha kunlik hisobotlar o&apos;zgaradi</b> (florist kunlik hisoboti,
                sklad jurnali, davr bo&apos;yicha hisob-kitob).
                {retroNote ? <span className="mt-0.5 block font-medium">{retroNote}</span> : null}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
