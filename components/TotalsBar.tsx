"use client";
import { fmt } from "@/lib/format";

/**
 * JADVAL OSTIDAGI / USTIDAGI JAMILAR — SERVERNING `totals` blokidan.
 *
 * ⚠️ Bu yerga HECH QACHON `results.length` yoki sahifadagi qatorlar yig'indisi
 * berilmaydi. `totals` sahifadan emas, FILTRGA tushgan butun ro'yxatdan
 * hisoblanadi — ya'ni 2-sahifaga o'tganda o'zgarmaydi, lekin filtr almashsa
 * o'zgaradi (spec: FRONTEND_PAGINATION_TOTALS_API.md).
 *
 * ⚠️ Pul qiymatlari serverdan STRING keladi — `lib/pagination` dagi
 * `totalsNum()` orqali songa o'tkazilgan holda berilsin.
 */
export type TotalItem = {
  label: string;
  /** tayyor matn yoki son; son bo'lsa `money` bayrog'iga qarab formatlanadi */
  value: string | number;
  money?: boolean;
  unit?: string;
  hue?: string;
  /** ⚠️ taxminiy ko'rsatkich — yonida izoh chiqadi */
  note?: string;
};

export default function TotalsBar({ items, loading = false }: { items: TotalItem[]; loading?: boolean }) {
  const shown = items.filter((i) => i.value !== "" && i.value !== null && i.value !== undefined);
  if (!shown.length) return null;
  return (
    <div className="mb-3 grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", opacity: loading ? 0.55 : 1 }}>
      {shown.map((i) => (
        <div key={i.label} className="glass !rounded-[14px] px-3.5 py-2.5" title={i.note || undefined}>
          <div className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
            {i.label}{i.note && <span aria-hidden style={{ color: "var(--warning-ink, #8a6d1f)" }}>*</span>}
          </div>
          <div className="mt-0.5 text-[16px] font-extrabold tabular-nums" style={{ color: i.hue ?? "var(--text)" }}>
            {typeof i.value === "number"
              ? (i.money ? fmt(i.value) : i.value.toLocaleString("ru"))
              : i.value}
            {i.unit && <span className="ml-1 text-[12px] font-semibold" style={{ color: "var(--muted)" }}>{i.unit}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}
