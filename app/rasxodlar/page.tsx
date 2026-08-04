"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Receipt, Trash2, Wallet } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useStore, usePerm } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { fmt, fmtLocalTime } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import FilterSelect from "@/components/FilterSelect";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import DatePicker from "@/components/DatePicker";
import ExpenseModal from "@/components/ExpenseModal";
import {
  buildExpenseQuery, expenseFiltersToParams, expensePageCount, expenseTotalsView,
  expenseNum, byDayChronological, byCategoryDesc, EXPENSE_PAGE_SIZE, EXPENSE_ORDERING_DEFAULT,
  type ExpenseFilters,
} from "@/lib/expenses";
import type { Expense, ExpenseCategories, ExpenseSummary } from "@/lib/types";

/** Tur chipi — mavjud token oilasidan, yangi rang KIRITILMAYDI. */
const CAT_TINT: Record<string, string> = {
  rent: "var(--primary)", utilities: "var(--acc)", salary: "var(--danger-ink)",
  transport: "var(--warning-ink, #8a6d1f)", supplies: "var(--text-2)", marketing: "var(--primary)",
  tax: "var(--danger-ink)", repair: "var(--warning-ink, #8a6d1f)", food: "var(--acc)", other: "var(--muted)",
};

/**
 * RASXODLAR — qo'lda kiritiladigan chiqimlar (ruxsat: `expenses`).
 *
 * ⚠️ Kartochkalar VA jadval AYNAN BIR XIL filtrni oladi (buildExpenseQuery) — aks holda
 * yig'indi ko'rinmayotgan narsani tasvirlab qoladi.
 * ⚠️ `net_profit` ga TEGMAYDI — Hisob-kitobda «Rasxoddan keyingi foyda» alohida qator.
 */
export default function RasxodlarPage() {
  const { showToast } = useStore();
  const { canView, canControl } = usePerm();
  const allowed = canView("expenses");
  const control = canControl("expenses");

  const [rows, setRows] = useState<Expense[] | null>(null);
  const [count, setCount] = useState(0);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [opts, setOpts] = useState<ExpenseCategories | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editItem, setEditItem] = useState<Expense | null>(null);
  const [confirmDel, setConfirmDel] = useState<Expense | null>(null);
  const [deleting, setDeleting] = useState(false);

  // FILTRLAR — hammasi SERVERDA, URL'da saqlanadi, bir-birini o'chirmaydi
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [category, setCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [ordering, setOrdering] = useState(EXPENSE_ORDERING_DEFAULT);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  useEffect(() => { const t = setTimeout(() => { setQ(search.trim()); setPage(1); }, 350); return () => clearTimeout(t); }, [search]);

  const filters: ExpenseFilters = useMemo(
    () => ({ dateFrom, dateTo, category, paymentMethod, minAmount, maxAmount, search: q, ordering, page, pageSize: EXPENSE_PAGE_SIZE }),
    [dateFrom, dateTo, category, paymentMethod, minAmount, maxAmount, q, ordering, page],
  );

  // URL — o'qish (bir marta) va yozish
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const df = p.get("date_from"); if (df) setDateFrom(df);
    const dt = p.get("date_to"); if (dt) setDateTo(dt);
    const c = p.get("category"); if (c) setCategory(c);
    const pm = p.get("pm"); if (pm) setPaymentMethod(pm);
    const mn = p.get("min"); if (mn) setMinAmount(mn);
    const mx = p.get("max"); if (mx) setMaxAmount(mx);
    const o = p.get("ordering"); if (o) setOrdering(o);
    const s = p.get("q"); if (s) { setSearch(s); setQ(s); }
    const pg = Number(p.get("page")); if (pg > 1) setPage(pg);
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    for (const k of ["date_from","date_to","category","pm","by","min","max","q","ordering","page"]) u.searchParams.delete(k);
    for (const [k, v] of Object.entries(expenseFiltersToParams(filters))) u.searchParams.set(k, v);
    window.history.replaceState(null, "", u);
  }, [filters]);

  // tur/to'lov ro'yxati — QATTIQ YOZILMAYDI, serverdan (bir marta)
  useEffect(() => { if (allowed) api.expenseCategories().then(setOpts).catch(() => {}); }, [allowed]);

  const load = useCallback(() => {
    if (!allowed) return;
    setLoading(true);
    // ⚠️ RO'YXAT va YIG'INDI — BIR XIL filtr (yig'indida sahifalash tushiriladi)
    Promise.all([
      api.expenses(buildExpenseQuery(filters)),
      api.expenseSummary(buildExpenseQuery(filters, true)),
    ])
      .then(([list, sum]) => { setRows(list.results ?? []); setCount(list.count ?? 0); setSummary(sum); setErr(""); })
      .catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi"))
      .finally(() => setLoading(false));
  }, [allowed, filters]);
  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  const doDelete = async () => {
    if (!confirmDel) return;
    setDeleting(true);
    try {
      await api.deleteExpense(confirmDel.id); // 204
      showToast("✓ Rasxod o'chirildi");
      setConfirmDel(null);
      load();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "O'chirib bo'lmadi");
    } finally { setDeleting(false); }
  };

  if (!allowed) return <div className="p-8"><EmptyState title="Ruxsat yo'q" sub="Bu sahifa «Rasxodlar» ruxsatini talab qiladi." /></div>;

  const t = expenseTotalsView(summary);
  const cats = byCategoryDesc(summary?.by_category);
  const days = byDayChronological(summary?.by_day);
  const maxCat = Math.max(...cats.map((c) => expenseNum(c.total)), 1);
  const maxDay = Math.max(...days.map((d) => expenseNum(d.total)), 1);
  const pages = expensePageCount(count, EXPENSE_PAGE_SIZE);
  const filtered = !!(dateFrom || dateTo || category || paymentMethod || minAmount || maxAmount || q);

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-5 sm:px-6">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-[22px] font-extrabold tracking-tight">
            <Wallet size={20} strokeWidth={1.9} style={{ color: "var(--primary)" }} /> Rasxodlar
          </h1>
          <p className="mt-0.5 text-[12.5px]" style={{ color: "var(--muted)" }}>
            Qo&apos;lda kiritiladigan chiqimlar — sotuv va sklad bilan bog&apos;lanmaydi
          </p>
        </div>
        {control && (
          <button onClick={() => { setEditItem(null); setFormOpen(true); }} className="btn-primary flex items-center gap-1.5">
            <Plus size={15} strokeWidth={2.2} /> Rasxod qo&apos;shish
          </button>
        )}
      </header>

      {/* KARTOCHKALAR — server bergani AYNAN, hech qachon qayta hisoblanmaydi */}
      <div className="mb-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        <Card label="Jami rasxod" value={fmt(t.total)} strong sub={filtered ? "tanlangan filtr bo'yicha" : "butun davr"} />
        <Card label="Nechta yozuv" value={String(t.count)} sub="rasxod yozuvi" />
        <Card label="O'rtacha" value={fmt(t.average)} sub="bitta yozuvga" />
      </div>

      {/* FILTRLAR */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="w-[148px]"><DatePicker value={dateFrom} onChange={(v) => { setDateFrom(v); setPage(1); }} placeholder="Sanadan" ariaLabel="Sanadan" /></div>
        <div className="w-[148px]"><DatePicker value={dateTo} onChange={(v) => { setDateTo(v); setPage(1); }} placeholder="Sanagacha" ariaLabel="Sanagacha" /></div>
        <FilterSelect value={category} label="Turi" onChange={(v) => { setCategory(v); setPage(1); }}
          options={[{ value: "", label: "Turi: hammasi" }, ...(opts?.categories ?? []).map((c) => ({ value: c.value, label: c.label }))]} />
        <FilterSelect value={paymentMethod} label="To'lov" onChange={(v) => { setPaymentMethod(v); setPage(1); }}
          options={[{ value: "", label: "To'lov: hammasi" }, ...(opts?.payment_methods ?? []).map((c) => ({ value: c.value, label: c.label }))]} />
        <FilterSelect value={ordering} label="Tartib" onChange={(v) => { setOrdering(v); setPage(1); }} options={[
          { value: "-spent_at", label: "Eng yangi" }, { value: "spent_at", label: "Eng eski" },
          { value: "-amount", label: "Katta summa" }, { value: "amount", label: "Kichik summa" },
        ]} />
        <input className="inp !h-[38px] w-[110px]" inputMode="numeric" placeholder="Min summa" value={minAmount}
          onChange={(e) => { setMinAmount(e.target.value.replace(/\D/g, "")); setPage(1); }} aria-label="Minimal summa" />
        <input className="inp !h-[38px] w-[110px]" inputMode="numeric" placeholder="Max summa" value={maxAmount}
          onChange={(e) => { setMaxAmount(e.target.value.replace(/\D/g, "")); setPage(1); }} aria-label="Maksimal summa" />
        <SearchInput value={search} onChange={setSearch} placeholder="Qayerga ketdi yoki izoh…" ariaLabel="Rasxod qidirish" />
        {filtered && (
          <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); setCategory(""); setPaymentMethod(""); setMinAmount(""); setMaxAmount(""); setSearch(""); setQ(""); setPage(1); }}
            className="text-[12px] font-bold underline underline-offset-2" style={{ color: "var(--primary)" }}>Tozalash</button>
        )}
      </div>

      {err && <p className="mb-3 rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{err}</p>}

      {/* IKKI VIZUAL — turlar (kattadan kichikka) va kunlar (XRONOLOGIK) */}
      {(cats.length > 0 || days.length > 0) && (
        <div className="mb-4 grid gap-3 lg:grid-cols-2">
          {cats.length > 0 && (
            <div className="rounded-[16px] border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface-solid)" }}>
              <div className="mb-2 text-[12px] font-extrabold" style={{ color: "var(--text-2)" }}>Turlar bo&apos;yicha</div>
              <div className="grid gap-1.5">
                {cats.map((c) => {
                  const v = expenseNum(c.total);
                  return (
                    <div key={c.category}>
                      <div className="flex items-baseline justify-between gap-2 text-[12px]">
                        <span className="truncate">{c.label}</span>
                        <span className="shrink-0 font-bold tabular-nums">{fmt(v)} <span style={{ color: "var(--muted)" }}>· {c.count}</span></span>
                      </div>
                      <div className="mt-0.5 h-[7px] overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                        <div className="h-full rounded-full" style={{ width: `${Math.max((v / maxCat) * 100, 2)}%`, background: CAT_TINT[c.category] ?? "var(--primary)" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {days.length > 0 && (
            <div className="rounded-[16px] border p-3.5" style={{ borderColor: "var(--border)", background: "var(--surface-solid)" }}>
              {/* ⚠️ by_day server'dan ENG YANGI BIRINCHI keladi — bu yerda XRONOLOGIK */}
              <div className="mb-2 text-[12px] font-extrabold" style={{ color: "var(--text-2)" }}>Kunlar bo&apos;yicha</div>
              <div className="flex h-[110px] items-end gap-1">
                {days.map((d) => {
                  const v = expenseNum(d.total);
                  return (
                    <div key={d.date} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.date}: ${fmt(v)} (${d.count})`}>
                      <div className="w-full rounded-t-[4px]" style={{ height: `${Math.max((v / maxDay) * 84, 3)}px`, background: "var(--primary)" }} />
                      <span className="text-[9px] tabular-nums" style={{ color: "var(--muted)" }}>{d.date.slice(8, 10)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? <FlowerLoader /> : !rows || rows.length === 0 ? (
        <EmptyState
          title={filtered ? "Bu filtr bo'yicha rasxod yo'q" : "Hali rasxod yozilmagan"}
          sub={filtered ? "Sana oralig'ini kengaytiring yoki turni «hammasi» qiling." : "«Rasxod qo'shish» tugmasi bilan ijara, transport, oylik kabi chiqimlarni yozib boring."}
        />
      ) : (
        <>
          <div className="overflow-x-auto rounded-[16px] border" style={{ borderColor: "var(--border)", background: "var(--surface-solid)" }}>
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-left" style={{ color: "var(--muted)" }}>
                  <th className="px-3 py-2.5 font-semibold">Sana</th>
                  <th className="px-2 py-2.5 font-semibold">Turi</th>
                  <th className="px-2 py-2.5 font-semibold">Qayerga ketdi</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Summa</th>
                  <th className="px-2 py-2.5 font-semibold">To&apos;lov</th>
                  <th className="px-2 py-2.5 font-semibold">Izoh</th>
                  <th className="px-2 py-2.5 font-semibold">Kim kiritdi</th>
                  {control && <th className="px-2 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {rows.map((e) => (
                  <tr key={e.id} className="border-t" style={{ borderColor: "var(--line2)" }}>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums" style={{ color: "var(--text-2)" }}>{fmtLocalTime(e.spent_at)}</td>
                    <td className="px-2 py-2.5">
                      <span className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                        style={{ background: `color-mix(in srgb, ${CAT_TINT[e.category] ?? "var(--muted)"} 15%, transparent)`, color: CAT_TINT[e.category] ?? "var(--muted)" }}>
                        {e.category_label || e.category}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 font-semibold">{e.destination}</td>
                    <td className="px-2 py-2.5 text-right font-bold tabular-nums">{fmt(expenseNum(e.amount))}</td>
                    <td className="px-2 py-2.5" style={{ color: "var(--text-2)" }}>{e.payment_method_label || e.payment_method}</td>
                    <td className="max-w-[190px] truncate px-2 py-2.5" title={e.note || ""} style={{ color: "var(--muted)" }}>{e.note || "—"}</td>
                    <td className="px-2 py-2.5" style={{ color: "var(--text-2)" }}>
                      {e.created_by_detail?.first_name || e.created_by_detail?.username || "—"}
                    </td>
                    {control && (
                      <td className="whitespace-nowrap px-2 py-2.5 text-right">
                        <button onClick={() => { setEditItem(e); setFormOpen(true); }} title="Tahrirlash"
                          className="mr-1 rounded-[9px] p-1.5 hover:bg-[var(--hover)]" style={{ color: "var(--text-2)" }}><Pencil size={14} /></button>
                        <button onClick={() => setConfirmDel(e)} title="O'chirish"
                          className="rounded-[9px] p-1.5 hover:bg-[var(--hover)]" style={{ color: "var(--danger-ink)" }}><Trash2 size={14} /></button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pages > 1 && (
            <div className="mt-3 flex items-center justify-center gap-2">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(p - 1, 1))}
                className="flex items-center gap-1 rounded-[11px] border-[1.5px] px-3 py-1.5 text-[12px] font-bold disabled:opacity-40"
                style={{ borderColor: "var(--border)", color: "var(--text-2)" }}><ChevronLeft size={13} /> Oldingi</button>
              <span className="text-[12px] font-semibold tabular-nums" style={{ color: "var(--muted)" }}>{page} / {pages}</span>
              <button type="button" disabled={page >= pages} onClick={() => setPage((p) => Math.min(p + 1, pages))}
                className="flex items-center gap-1 rounded-[11px] border-[1.5px] px-3 py-1.5 text-[12px] font-bold disabled:opacity-40"
                style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>Keyingi <ChevronRight size={13} /></button>
            </div>
          )}
        </>
      )}

      {confirmDel && (
        <div className="mt-4 rounded-[13px] border-[1.5px] p-3.5" style={{ borderColor: "var(--danger-ink)", background: "var(--danger-soft, rgba(160,74,74,.12))" }}>
          <p className="text-[12.5px] font-bold" style={{ color: "var(--danger-ink)" }}>
            «{confirmDel.destination}» — {fmt(expenseNum(confirmDel.amount))} rasxodini o&apos;chirasizmi?
          </p>
          <p className="mt-1 text-[11.5px] font-medium" style={{ color: "var(--danger-ink)" }}>Hisob-kitobdagi «Rasxoddan keyingi foyda» darhol o&apos;zgaradi.</p>
          <div className="mt-2.5 flex gap-2">
            <button onClick={() => setConfirmDel(null)} className="btn-ghost !py-1.5 !text-[12.5px]">Bekor</button>
            <button onClick={doDelete} disabled={deleting} className="rounded-[11px] px-3 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-60" style={{ background: "var(--danger-ink)" }}>
              {deleting ? "O'chirilmoqda…" : "Ha, o'chirish"}
            </button>
          </div>
        </div>
      )}

      {formOpen && (
        <ExpenseModal
          expense={editItem}
          options={opts}
          onClose={() => { setFormOpen(false); setEditItem(null); }}
          onSaved={() => { setFormOpen(false); setEditItem(null); load(); }}
        />
      )}
    </div>
  );
}

function Card({ label, value, sub, strong }: { label: string; value: string; sub?: string; strong?: boolean }) {
  return (
    <div className="rounded-[16px] border px-4 py-3" style={{ borderColor: strong ? "var(--primary)" : "var(--border)", background: strong ? "var(--primary-soft)" : "var(--surface-solid)" }}>
      <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="mt-0.5 text-[19px] font-extrabold tabular-nums" style={{ color: strong ? "var(--danger-ink)" : "var(--text)" }}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px]" style={{ color: "var(--muted)" }}>{sub}</div>}
    </div>
  );
}
