"use client";
import { useMemo, useState } from "react";
import { fmt } from "@/lib/format";
import { columnsOf, isMoneyCol, isTextCol } from "@/lib/excelStats";
import type { ExcelRow, ExcelStats } from "@/lib/types";

/**
 * EXCEL USLUBIDAGI KUNLIK JADVALLAR — `dashboard.excel_stats`.
 *
 * ⚠️ Ustun turlari (matn / pul / dona) lib/excelStats.ts da — u yer testlanadi.
 *
 * ⚠️ USTUNLAR KODDA QOTIRILMAYDI. `rasxod` jadvalining ustunlari — FLORIST
 * ISMLARI (jonli: ABO, BEGZOD, ISO, BAKIR, FATXULLO, ZAFAR, SHOHAKBAR …).
 * Xodim qo'shilsa yoki ishdan ketsa ustunlar ham o'zgaradi. Shu bois ustunlar
 * QATORLARDAN yig'iladi: agar ro'yxatni kodda yozib qo'ysak, yangi xodimning
 * ustuni jimgina ko'rinmay qolardi.
 *
 * ⚠️ Qiymatlar son yoki satr bo'lishi mumkin. `№` va `SANA` — matn ustunlari,
 * qolganlari pul sifatida formatlanadi.
 */

type TabKey = "sovda" | "rasxod" | "yandex";
const TABS: { key: TabKey; label: string }[] = [
  { key: "sovda", label: "Sovda" },
  { key: "rasxod", label: "Rasxod" },
  { key: "yandex", label: "Yandex" },
];

const cell = (v: ExcelRow[string], col: string, sheet: TabKey): string => {
  if (v == null || v === "") return "—";
  if (isTextCol(col)) return String(v);
  const n = Number(v);
  if (!Number.isFinite(n)) return String(v);   // son emas (izoh matni) — o'zini ko'rsatamiz
  if (n === 0) return "—";                     // nol — bo'sh katak, «0 so'm» shovqin qilmaydi
  return isMoneyCol(sheet, col) ? fmt(n) : n.toLocaleString("ru");
};

export default function ExcelStatsTables({ stats }: { stats?: ExcelStats | null }) {
  const [tab, setTab] = useState<TabKey>("sovda");
  const rows = useMemo(() => (stats?.[tab] ?? []) as ExcelRow[], [stats, tab]);
  const cols = useMemo(() => columnsOf(rows), [rows]);

  const has = TABS.some((t) => (stats?.[t.key] ?? []).length > 0);
  if (!has) return null;

  const totals = stats?.totals ?? {};

  return (
    <section className="mt-6" aria-label="Excel hisobot jadvallari">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-[13px] font-bold uppercase tracking-[1.5px]" style={{ color: "var(--text-2)" }}>Excel hisoboti</h3>
        <div className="flex gap-1 rounded-full border p-1" style={{ borderColor: "var(--border)" }}>
          {TABS.map((t) => {
            const n = (stats?.[t.key] ?? []).length;
            return (
              <button key={t.key} type="button" onClick={() => setTab(t.key)} aria-pressed={tab === t.key}
                className="rounded-full px-3 py-1.5 text-[12.5px] font-bold transition-colors duration-150"
                style={tab === t.key ? { background: "var(--primary)", color: "#fff" } : { color: "var(--muted)" }}>
                {t.label} <span className="tabular-nums opacity-70">{n}</span>
              </button>
            );
          })}
        </div>
        {/* ⚠️ JAMILAR SERVERDAN — jadval qatorlaridan yig'ilmaydi */}
        <div className="ml-auto flex flex-wrap gap-x-3 gap-y-1 text-[12px]" style={{ color: "var(--muted)" }}>
          {Object.entries(totals).filter(([, v]) => Number(v) > 0).map(([k, v]) => (
            <span key={k}><span className="uppercase">{k}</span> <b className="tabular-nums" style={{ color: "var(--text-2)" }}>{fmt(Number(v))}</b></span>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-[14px] border border-dashed py-6 text-center text-[13px]" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
          Bu davrda yozuv yo&apos;q.
        </p>
      ) : (
        /* ⚠️ Ustunlar ko'p (rasxodda 20+) — gorizontal skroll O'Z konteynerida,
            sahifa o'zi yon tomonga surilmaydi. */
        <div className="glass overflow-x-auto !rounded-[16px]">
          <table className="w-full border-collapse text-[12.5px]">
            <thead>
              <tr className="bg-tint text-tintink">
                {cols.map((c) => (
                  <th key={c} className="whitespace-nowrap px-3 py-2.5 text-left text-[10.5px] font-bold uppercase tracking-wider">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-t" style={{ borderColor: "var(--line2)" }}>
                  {cols.map((c) => (
                    <td key={c} className={`whitespace-nowrap px-3 py-2 ${isTextCol(c) ? "" : "text-right tabular-nums"}`}
                      style={isTextCol(c) ? { color: "var(--text-2)", fontWeight: 600 } : undefined}>
                      {cell(r?.[c], c, tab)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
