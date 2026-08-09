"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import FilterSelect from "./FilterSelect";
import ClearFilters from "./ClearFilters";
import DateChips from "./DateChips";
import EmptyState from "./EmptyState";
import { dateAfterParam, fmt, fmtDate, rangeParams } from "@/lib/format";
import { SALARY_SOURCE_LABEL, salarySourceLabel, salarySourceHue } from "@/lib/inventory";
import { hasArithmetic, arithmeticLabel } from "@/lib/decoration";
import SalaryEditModal from "./SalaryEditModal";
import { usePerm } from "@/lib/store";
import { Pencil } from "lucide-react";
import type { FloristProfile, FloristSalaryEntry, SalarySource } from "@/lib/types";

const SOURCE_OPTS = [
  { value: "", label: "Barcha manbalar" },
  ...(Object.keys(SALARY_SOURCE_LABEL) as SalarySource[]).map((s) => ({ value: s, label: SALARY_SOURCE_LABEL[s] })),
];

/** Oyliklar — kunlar bo'yicha guruh + florist bo'yicha leaderboard strip. */
export default function SalaryLedger() {
  const { showToast, dateFilter, dateRange, setDateFilter } = useStore();
  const [rows, setRows] = useState<FloristSalaryEntry[] | null>(null);
  const [florists, setFlorists] = useState<FloristProfile[]>([]);
  const [floristId, setFloristId] = useState("");
  const [source, setSource] = useState("");
  // tahrir — `florists` can_control bo'lganda
  const canEdit = usePerm().canControl("florists");
  const [editing, setEditing] = useState<FloristSalaryEntry | null>(null);

  const load = useCallback(() => {
    api.floristSalary({
      ordering: "-work_date",
      florist: floristId || undefined,
      source: source || undefined,
      ...(dateRange ? rangeParams(dateRange) : { created_at_after: dateAfterParam(dateFilter) }),
    }).then(setRows).catch((e) => showToast(e instanceof Error ? e.message : "Yuklashda xatolik"));
  }, [showToast, floristId, source, dateFilter, dateRange]);
  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);
  useEffect(() => { api.florists({ ordering: "user", page_size: "all" }).then(setFlorists).catch(() => {}); }, []);

  const floristName = (fp?: FloristProfile) => {
    const u = fp?.user_detail;
    return u ? [u.first_name, u.last_name].filter(Boolean).join(" ") || u.username : `Florist #${fp?.id ?? "?"}`;
  };

  // leaderboard: florist bo'yicha jami
  const board = useMemo(() => {
    const m = new Map<number, { name: string; total: number }>();
    (rows ?? []).forEach((r) => {
      const key = r.florist;
      const name = floristName(r.florist_detail) || `#${key}`;
      const cur = m.get(key) ?? { name, total: 0 };
      cur.total += +r.amount || 0;
      m.set(key, cur);
    });
    return Array.from(m.values()).sort((a, b) => b.total - a.total);
  }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const maxTotal = Math.max(...board.map((b) => b.total), 1);

  // kunlar bo'yicha guruh
  const grouped = useMemo(() => {
    const g = new Map<string, FloristSalaryEntry[]>();
    (rows ?? []).forEach((r) => { const d = r.work_date || (r.created_at ?? "").slice(0, 10); (g.get(d) ?? g.set(d, []).get(d)!).push(r); });
    return Array.from(g.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [rows]);

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>Oyliklar — katalog/kunlik/qo&apos;lda hisoblangan</p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <FilterSelect value={floristId} options={[{ value: "", label: "Barcha floristlar" }, ...florists.map((fp) => ({ value: String(fp.id), label: floristName(fp) }))]} onChange={setFloristId} label="Florist" />
          <FilterSelect value={source} options={SOURCE_OPTS} onChange={setSource} label="Manba" />
          <DateChips />
          <ClearFilters show={!!(floristId || source || dateRange || dateFilter !== "oy")} onClear={() => { setFloristId(""); setSource(""); setDateFilter("oy"); }} />
        </div>
      </div>

      {/* leaderboard strip */}
      {board.length > 0 && (
        <div className="glass mb-4 flex flex-col gap-2 !rounded-[18px] p-4">
          {board.map((b) => (
            <div key={b.name} className="flex items-center gap-3">
              <span className="w-[110px] shrink-0 truncate text-[13px] font-semibold" title={b.name}>{b.name}</span>
              <div className="h-[10px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                <div className="h-full rounded-full transition-[width] duration-500" style={{ width: `${(b.total / maxTotal) * 100}%`, background: "var(--primary)" }} />
              </div>
              <span className="w-[110px] shrink-0 text-right text-[13px] font-bold tabular-nums">{fmt(b.total)}</span>
            </div>
          ))}
        </div>
      )}

      {/* kunlar bo'yicha */}
      {rows === null && <p className="py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>}
      {rows?.length === 0 && <EmptyState title="Yozuv yo'q" sub="Tanlangan davrda oylik yozuvi topilmadi." />}
      <div className="flex flex-col gap-4">
        {grouped.map(([date, items]) => (
          <section key={date} className="glass !rounded-[18px] p-4">
            <div className="mb-2 text-[13px] font-bold" style={{ color: "var(--text-2)" }}>{fmtDate(date)}</div>
            {items.map((r) => {
              const hue = salarySourceHue(r.source);
              return (
                <div key={r.id} className="flex items-center gap-3 border-t py-2.5 first:border-t-0" style={{ borderColor: "var(--line2)" }}>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-semibold" title={floristName(r.florist_detail)}>{floristName(r.florist_detail)}</span>
                  <span className="shrink-0 whitespace-nowrap rounded-full border px-2 py-[3px] text-[11px] font-bold" style={{ background: `color-mix(in srgb, ${hue} 13%, transparent)`, borderColor: `color-mix(in srgb, ${hue} 28%, transparent)`, color: `color-mix(in srgb, ${hue} 72%, var(--text))` }}>
                    {salarySourceLabel(r.source)}
                  </span>
                  {r.note && <span className="hidden max-w-[160px] shrink-0 truncate text-[12px] sm:block" style={{ color: "var(--muted)" }} title={r.note}>{r.note}</span>}
                  {/* ⚠️ HISOB — BITTA shart: `quantity` ham, `unit_amount` ham > 0 bo'lsa.
                      Boshqa manbalarda ikkalasi 0 — o'shanda faqat summa chiqadi (spec §6). */}
                  {hasArithmetic(r) && (
                    <span className="shrink-0 whitespace-nowrap text-[12px] tabular-nums" style={{ color: "var(--muted)" }}>{arithmeticLabel(r)}</span>
                  )}
                  <span className="shrink-0 text-[13px] font-bold tabular-nums" style={{ color: "var(--acc)" }}>{fmt(r.amount)}</span>
                  {canEdit && (
                    <button type="button" onClick={() => setEditing(r)} className="icon-btn !h-7 !w-7 shrink-0" title="Tuzatish" aria-label="Yozuvni tuzatish">
                      <Pencil size={13} strokeWidth={1.9} />
                    </button>
                  )}
                </div>
              );
            })}
          </section>
        ))}
      </div>

      {editing && (
        <SalaryEditModal entry={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />
      )}
    </>
  );
}
