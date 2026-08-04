"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Trash2, Wallet, X } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { useStore, usePerm } from "@/lib/store";
import { fmt } from "@/lib/format";
import SearchInput from "@/components/SearchInput";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import ExpenseQuickAdd from "@/components/ExpenseQuickAdd";
import {
  visibleRange, monthRange, groupByDay, dayTotal, spentDate, spentTime, expenseNum,
  expenseTotalsView, buildExpenseQuery, PAYMENT_DOT, MONTHS_UZ, WEEKDAYS_UZ,
  type CalView,
} from "@/lib/expenses";
import type { Expense, ExpenseOptions, ExpenseSummary } from "@/lib/types";

const todayYmd = () => {
  const d = new Date(Date.now() + 5 * 3600_000); // Toshkent
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
};
const VIEWS: { v: CalView; label: string }[] = [
  { v: "oy", label: "Oy" }, { v: "hafta", label: "Hafta" }, { v: "kun", label: "Kun" }, { v: "royxat", label: "Ro'yxat" },
];

/**
 * RASXODLAR — Google Calendar ko'rinishi (ruxsat: `expenses`).
 *
 * ⚠️ `category` MODELDAN OLIB TASHLANGAN — rang endi TO'LOV USULI bo'yicha (nuqtacha).
 * ⚠️ Kataklarga guruhlash `spent_at` ning MAHALLIY sana qismidan (UTC o'girish YO'Q).
 * ⚠️ Oy almashganda oldingi so'rov ABORT qilinadi — tez ‹ › bosilganda eski oy
 *    ma'lumoti chizilib qolmasin.
 */
export default function RasxodlarPage() {
  const { showToast } = useStore();
  const { canView, canControl } = usePerm();
  const allowed = canView("expenses");
  const control = canControl("expenses");

  const [view, setView] = useState<CalView>("oy");
  const [cursor, setCursor] = useState(() => { const t = todayYmd(); return { y: +t.slice(0, 4), m: +t.slice(5, 7) - 1, d: +t.slice(8, 10) }; });
  const [rows, setRows] = useState<Expense[]>([]);
  const [truncated, setTruncated] = useState(0);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [opts, setOpts] = useState<ExpenseOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [dayPanel, setDayPanel] = useState<string | null>(null);
  const [addFor, setAddFor] = useState<{ day: string | null } | null>(null);
  const [editItem, setEditItem] = useState<Expense | null>(null);
  const [confirmDel, setConfirmDel] = useState<Expense | null>(null);
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 350); return () => clearTimeout(t); }, [search]);

  const today = todayYmd();
  const range = useMemo(() => visibleRange(cursor.y, cursor.m, view, cursor.d), [cursor, view]);
  const mRange = useMemo(() => monthRange(cursor.y, cursor.m), [cursor]);

  // URL — ko'rinish va oy saqlanadi (yangilash / ulashilgan havola o'sha joyga tushadi)
  // ⚠️ YOZISH o'qishdan KEYIN qurollanadi: aks holda birinchi renderdagi sukut holat
  // (`oy`) URL'dagi `?view=hafta` ni bosib ketardi va chuqur havola ishlamasdi.
  const urlArmed = useRef<boolean>(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const v = p.get("view"); if (v === "oy" || v === "hafta" || v === "kun" || v === "royxat") setView(v);
    const d = p.get("d");
    if (d && /^\d{4}-\d{2}-\d{2}$/.test(d)) setCursor({ y: +d.slice(0, 4), m: +d.slice(5, 7) - 1, d: +d.slice(8, 10) });
  }, []);
  useEffect(() => {
    // BIRINCHI yurish o'tkazib yuboriladi — u hali URL'dan o'qilgan holatni emas,
    // sukut holatni yozardi (chuqur havola shu sababli ishlamasdi).
    if (urlArmed.current === false) { urlArmed.current = true; return; }
    if (typeof window === "undefined") return;
    const u = new URL(window.location.href);
    u.searchParams.set("view", view);
    u.searchParams.set("d", `${cursor.y}-${String(cursor.m + 1).padStart(2, "0")}-${String(cursor.d).padStart(2, "0")}`);
    window.history.replaceState(null, "", u);
  }, [view, cursor]);

  useEffect(() => { if (allowed) api.expenseOptions().then(setOpts).catch(() => {}); }, [allowed]);

  // ⚠️ ABORT — oy tez almashsa eski javob kelib chizilmasin
  const abortRef = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    if (!allowed) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setLoading(true);
    try {
      const listQ = view === "royxat"
        ? buildExpenseQuery({ search: q, minAmount, maxAmount, pageSize: 100, ordering: "-spent_at" })
        : { date_from: range.from, date_to: range.to, page_size: 500, ordering: "spent_at" };
      const [list, sum] = await Promise.all([
        api.expenses(listQ, ac.signal),
        api.expenseSummary({ date_from: mRange.from, date_to: mRange.to }, ac.signal),
      ]);
      if (ac.signal.aborted) return;
      setRows(list.results ?? []);
      // ⚠️ 500 dan ko'p bo'lsa JIMGINA tashlab ketmaymiz — ochiq aytamiz
      setTruncated(Math.max((list.count ?? 0) - (list.results?.length ?? 0), 0));
      setSummary(sum);
      setErr("");
    } catch (e) {
      if ((e as { name?: string })?.name === "AbortError" || ac.signal.aborted) return;
      setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi");
    } finally {
      if (!ac.signal.aborted) setLoading(false);
    }
  }, [allowed, view, range.from, range.to, mRange.from, mRange.to, q, minAmount, maxAmount]);
  useEffect(() => { load(); return () => abortRef.current?.abort(); }, [load]);

  const shift = useCallback((dir: number) => setCursor((c) => {
    if (view === "kun") { const d = new Date(Date.UTC(c.y, c.m, c.d + dir)); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() }; }
    if (view === "hafta") { const d = new Date(Date.UTC(c.y, c.m, c.d + dir * 7)); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate() }; }
    const d = new Date(Date.UTC(c.y, c.m + dir, 1)); return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: 1 };
  }), [view]);
  const goToday = useCallback(() => { const t = todayYmd(); setCursor({ y: +t.slice(0, 4), m: +t.slice(5, 7) - 1, d: +t.slice(8, 10) }); }, []);

  // KLAVIATURA — input fokusda bo'lsa TEGMAYDI
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      if (e.key === "Escape") { setDayPanel(null); setAddFor(null); setEditItem(null); setConfirmDel(null); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); shift(-1); }
      else if (e.key === "ArrowRight") { e.preventDefault(); shift(1); }
      else if (e.key === "t" || e.key === "T") goToday();
      else if ((e.key === "n" || e.key === "N") && control) setAddFor({ day: null });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shift, goToday, control]);

  const byDay = useMemo(() => groupByDay(rows), [rows]);
  const t = expenseTotalsView(summary);

  const doDelete = async () => {
    if (!confirmDel) return;
    try {
      await api.deleteExpense(confirmDel.id); // 204
      showToast("✓ Rasxod o'chirildi");
      setConfirmDel(null); setEditItem(null);
      load();
    } catch (e) { showToast(e instanceof ApiError ? e.message : "O'chirib bo'lmadi"); }
  };

  if (!allowed) return <div className="p-8"><EmptyState title="Ruxsat yo'q" sub="Bu sahifa «Rasxodlar» ruxsatini talab qiladi." /></div>;

  const periodLabel = view === "kun"
    ? `${cursor.d}-${MONTHS_UZ[cursor.m].toLowerCase()} ${cursor.y}`
    : view === "hafta"
      ? `${range.from.slice(8)}–${range.to.slice(8)} ${MONTHS_UZ[cursor.m].toLowerCase()} ${cursor.y}`
      : `${MONTHS_UZ[cursor.m]} ${cursor.y}`;

  const Entry = ({ e, compact }: { e: Expense; compact?: boolean }) => (
    <button type="button" onClick={(ev) => { ev.stopPropagation(); setEditItem(e); }}
      className="flex w-full items-center gap-1.5 rounded-[6px] px-1 py-[3px] text-left transition-colors hover:bg-[var(--hover)]">
      <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: PAYMENT_DOT[e.payment_method] ?? "var(--muted)" }} />
      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{e.destination}</span>
      {!compact && <span className="shrink-0 text-[10.5px] tabular-nums" style={{ color: "var(--muted)" }}>{Math.round(expenseNum(e.amount) / 1000)}k</span>}
    </button>
  );

  return (
    <div className="mx-auto max-w-[1280px] px-3 py-4 sm:px-6 sm:py-5">
      {/* SARLAVHA */}
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="flex items-center gap-2 text-[20px] font-extrabold tracking-tight">
          <Wallet size={19} strokeWidth={1.9} style={{ color: "var(--primary)" }} /> Rasxodlar
        </h1>
        <button onClick={goToday} className="rounded-[11px] border-[1.5px] px-3 py-1.5 text-[12.5px] font-bold"
          style={{ borderColor: "var(--border)", color: "var(--text-2)" }}>Bugun</button>
        <div className="flex items-center gap-0.5">
          <button onClick={() => shift(-1)} aria-label="Oldingi" className="rounded-[9px] p-1.5 hover:bg-[var(--hover)]"><ChevronLeft size={17} /></button>
          <button onClick={() => shift(1)} aria-label="Keyingi" className="rounded-[9px] p-1.5 hover:bg-[var(--hover)]"><ChevronRight size={17} /></button>
        </div>
        <span className="text-[15px] font-bold">{periodLabel}</span>
        <div className="ml-auto flex items-center gap-1 rounded-full border p-1" style={{ borderColor: "var(--border)" }}>
          {VIEWS.map((v) => (
            <button key={v.v} onClick={() => setView(v.v)} aria-pressed={view === v.v}
              className="rounded-full px-3 py-1 text-[12px] font-bold transition-colors"
              style={view === v.v ? { background: "var(--primary)", color: "#fff" } : { color: "var(--muted)" }}>{v.label}</button>
          ))}
        </div>
        {control && (
          <button onClick={() => setAddFor({ day: null })} aria-label="Yangi rasxod"
            className="grid h-9 w-9 place-items-center rounded-full text-white" style={{ background: "var(--primary)" }}>
            <Plus size={18} strokeWidth={2.4} />
          </button>
        )}
      </header>

      <div className="mb-3 flex flex-wrap items-baseline gap-x-3 text-[12.5px]" style={{ color: "var(--text-2)" }}>
        <span>Oylik jami: <b className="tabular-nums" style={{ color: "var(--acc)" }}>{fmt(t.total)}</b></span>
        <span style={{ color: "var(--muted)" }}>· {t.count} ta</span>
        {truncated > 0 && (
          <span className="font-bold" style={{ color: "var(--warning-ink, #8a6d1f)" }}>
            ⚠️ {truncated} ta yozuv ko&apos;rsatilmadi — oraliqni qisqartiring
          </span>
        )}
      </div>

      {err && <p className="mb-3 rounded-[11px] px-3 py-2 text-[12.5px] font-semibold" style={{ background: "var(--danger-soft, rgba(160,74,74,.12))", color: "var(--danger-ink)" }}>{err}</p>}

      {loading ? <FlowerLoader /> : view === "royxat" ? (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <SearchInput value={search} onChange={setSearch} placeholder="Qayerga ketdi yoki izoh…" ariaLabel="Rasxod qidirish" />
            <input className="inp !h-[38px] w-[110px]" inputMode="numeric" placeholder="Min summa" value={minAmount}
              onChange={(e) => setMinAmount(e.target.value.replace(/\D/g, ""))} aria-label="Minimal summa" />
            <input className="inp !h-[38px] w-[110px]" inputMode="numeric" placeholder="Max summa" value={maxAmount}
              onChange={(e) => setMaxAmount(e.target.value.replace(/\D/g, ""))} aria-label="Maksimal summa" />
          </div>
          {rows.length === 0 ? <EmptyState title="Rasxod topilmadi" sub="Filtrlarni kengaytiring yoki kalendardan kun tanlab qo'shing." /> : (
            <div className="overflow-x-auto rounded-[16px] border" style={{ borderColor: "var(--border)", background: "var(--surface-solid)" }}>
              <table className="w-full text-[12.5px]">
                <thead><tr className="text-left" style={{ color: "var(--muted)" }}>
                  <th className="px-3 py-2.5 font-semibold">Sana</th><th className="px-2 py-2.5 font-semibold">Qayerga ketdi</th>
                  <th className="px-2 py-2.5 text-right font-semibold">Summa</th><th className="px-2 py-2.5 font-semibold">To&apos;lov</th>
                  <th className="px-2 py-2.5 font-semibold">Izoh</th><th className="px-2 py-2.5 font-semibold">Kim kiritdi</th>
                  {control && <th />}
                </tr></thead>
                <tbody>
                  {rows.map((e) => (
                    <tr key={e.id} className="border-t" style={{ borderColor: "var(--line2)" }}>
                      <td className="whitespace-nowrap px-3 py-2.5 tabular-nums" style={{ color: "var(--text-2)" }}>{spentDate(e.spent_at)} · {spentTime(e.spent_at)}</td>
                      <td className="px-2 py-2.5 font-semibold">
                        <span className="mr-1.5 inline-block h-[7px] w-[7px] rounded-full align-middle" style={{ background: PAYMENT_DOT[e.payment_method] ?? "var(--muted)" }} />
                        {e.destination}
                      </td>
                      <td className="px-2 py-2.5 text-right font-bold tabular-nums">{fmt(expenseNum(e.amount))}</td>
                      <td className="px-2 py-2.5" style={{ color: "var(--text-2)" }}>{e.payment_method_label || e.payment_method}</td>
                      <td className="max-w-[200px] truncate px-2 py-2.5" title={e.note || ""} style={{ color: "var(--muted)" }}>{e.note || "—"}</td>
                      <td className="px-2 py-2.5" style={{ color: "var(--text-2)" }}>{e.created_by_detail?.first_name || e.created_by_detail?.username || "—"}</td>
                      {control && (
                        <td className="whitespace-nowrap px-2 py-2.5 text-right">
                          <button onClick={() => setEditItem(e)} aria-label="Tahrirlash" className="mr-1 rounded-[9px] p-1.5 hover:bg-[var(--hover)]" style={{ color: "var(--text-2)" }}><Pencil size={14} /></button>
                          <button onClick={() => setConfirmDel(e)} aria-label="O'chirish" className="rounded-[9px] p-1.5 hover:bg-[var(--hover)]" style={{ color: "var(--danger-ink)" }}><Trash2 size={14} /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          {/* ⚠️ MOBIL — to'r o'rniga KUNLAR RO'YXATI (spec §10.5) */}
          <div className="sm:hidden">
            {range.days.filter((d) => (byDay[d]?.length ?? 0) > 0).length === 0 ? (
              <EmptyState title="Bu davrda rasxod yo'q" sub="Pastdagi + tugmasi bilan qo'shing." />
            ) : range.days.filter((d) => (byDay[d]?.length ?? 0) > 0).map((d) => (
              <div key={d} className="mb-2 rounded-[14px] border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-solid)" }}>
                <div className="mb-1.5 flex items-baseline justify-between gap-2">
                  <span className="text-[12.5px] font-extrabold">{+d.slice(8)}-{MONTHS_UZ[+d.slice(5, 7) - 1].toLowerCase()}</span>
                  <span className="text-[12.5px] font-bold tabular-nums" style={{ color: "var(--acc)" }}>{fmt(dayTotal(byDay[d]))}</span>
                </div>
                <div className="grid gap-0.5">{(byDay[d] ?? []).map((e) => <Entry key={e.id} e={e} />)}</div>
              </div>
            ))}
          </div>

          {/* TO'R — oy / hafta / kun */}
          <div className="hidden sm:block">
            {view !== "kun" && (
              <div className="grid gap-px overflow-hidden rounded-t-[14px] border border-b-0 text-[11px] font-bold"
                style={{ gridTemplateColumns: "repeat(7,1fr)", borderColor: "var(--border)", background: "var(--border)", color: "var(--muted)" }}>
                {WEEKDAYS_UZ.map((w) => <div key={w} className="px-2 py-1.5 text-center" style={{ background: "var(--surface-2)" }}>{w}</div>)}
              </div>
            )}
            <div className={clsx("grid gap-px overflow-hidden border", view === "kun" ? "rounded-[14px]" : "rounded-b-[14px]")}
              style={{ gridTemplateColumns: view === "kun" ? "1fr" : "repeat(7,1fr)", borderColor: "var(--border)", background: "var(--border)" }}>
              {range.days.map((d) => {
                const list = byDay[d] ?? [];
                const inMonth = view !== "oy" || +d.slice(5, 7) - 1 === cursor.m;
                const isToday = d === today;
                const shown = view === "oy" ? list.slice(0, 3) : list;
                const more = view === "oy" ? list.length - shown.length : 0;
                return (
                  <div key={d} onClick={() => (control ? setAddFor({ day: d }) : setDayPanel(d))}
                    className={clsx("min-h-[92px] p-1.5 transition-colors", control && "cursor-pointer hover:bg-[var(--hover)]", view === "kun" && "min-h-[320px]")}
                    style={{ background: isToday ? "var(--primary-soft)" : "var(--surface-solid)", opacity: inMonth ? 1 : 0.45 }}>
                    <div className="mb-1 flex items-baseline justify-between gap-1">
                      <span className={clsx("text-[11.5px]", isToday ? "font-extrabold" : "font-semibold")}
                        style={{ color: isToday ? "var(--primary)" : "var(--text-2)" }}>
                        {isToday && "● "}{+d.slice(8)}
                      </span>
                      {list.length > 0 && <span className="text-[11px] font-extrabold tabular-nums">{fmt(dayTotal(list))}</span>}
                    </div>
                    <div className="grid gap-0.5">
                      {shown.map((e) => <Entry key={e.id} e={e} compact={view === "oy"} />)}
                      {more > 0 && (
                        <button type="button" onClick={(ev) => { ev.stopPropagation(); setDayPanel(d); }}
                          className="px-1 text-left text-[10.5px] font-bold" style={{ color: "var(--primary)" }}>+{more} ta</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* MOBIL suzuvchi + */}
      {control && (
        <button onClick={() => setAddFor({ day: null })} aria-label="Yangi rasxod"
          className="fixed bottom-5 right-5 z-30 grid h-14 w-14 place-items-center rounded-full text-white shadow-xl sm:hidden"
          style={{ background: "var(--primary)" }}><Plus size={24} strokeWidth={2.4} /></button>
      )}

      {/* KUN PANELI — o'ngdan */}
      {dayPanel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/25" onClick={() => setDayPanel(null)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[380px] flex-col border-l p-4"
            style={{ background: "var(--surface-solid)", borderColor: "var(--border)" }}>
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="text-[15px] font-extrabold">{+dayPanel.slice(8)}-{MONTHS_UZ[+dayPanel.slice(5, 7) - 1].toLowerCase()}</div>
                <div className="text-[12px]" style={{ color: "var(--muted)" }}>
                  Jami: <b style={{ color: "var(--acc)" }}>{fmt(dayTotal(byDay[dayPanel]))}</b> · {(byDay[dayPanel] ?? []).length} ta
                </div>
              </div>
              <button onClick={() => setDayPanel(null)} aria-label="Yopish" className="rounded-[9px] p-1.5 hover:bg-[var(--hover)]"><X size={17} /></button>
            </div>
            <div className="thin-scroll flex-1 overflow-y-auto">
              {(byDay[dayPanel] ?? []).map((e) => (
                <div key={e.id} className="border-t py-2.5" style={{ borderColor: "var(--line2)" }}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[11.5px] tabular-nums" style={{ color: "var(--muted)" }}>{spentTime(e.spent_at)}</span>
                    <span className="flex-1 text-[13px] font-bold">{e.destination}</span>
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-[12px]" style={{ color: "var(--text-2)" }}>
                    <span className="h-[7px] w-[7px] rounded-full" style={{ background: PAYMENT_DOT[e.payment_method] ?? "var(--muted)" }} />
                    <b className="tabular-nums">{fmt(expenseNum(e.amount))}</b> · {e.payment_method_label || e.payment_method}
                  </div>
                  {e.note && <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>{e.note}</p>}
                  {control && (
                    <div className="mt-1 flex gap-1">
                      <button onClick={() => setEditItem(e)} aria-label="Tahrirlash" className="rounded-[9px] p-1.5 hover:bg-[var(--hover)]" style={{ color: "var(--text-2)" }}><Pencil size={14} /></button>
                      <button onClick={() => setConfirmDel(e)} aria-label="O'chirish" className="rounded-[9px] p-1.5 hover:bg-[var(--hover)]" style={{ color: "var(--danger-ink)" }}><Trash2 size={14} /></button>
                    </div>
                  )}
                </div>
              ))}
              {(byDay[dayPanel] ?? []).length === 0 && <p className="py-6 text-center text-[12.5px]" style={{ color: "var(--muted)" }}>Bu kunda rasxod yo&apos;q</p>}
            </div>
            {control && (
              <button onClick={() => { setAddFor({ day: dayPanel }); setDayPanel(null); }}
                className="mt-2 w-full rounded-[12px] border-[1.5px] border-dashed py-2.5 text-[12.5px] font-bold"
                style={{ borderColor: "var(--primary)", color: "var(--primary)" }}>+ Shu kunga qo&apos;shish</button>
            )}
          </aside>
        </>
      )}

      {confirmDel && (
        <div className="fixed inset-0 z-[60] grid place-items-center bg-black/35 p-4" onClick={() => setConfirmDel(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[340px] rounded-[16px] p-4" style={{ background: "var(--surface-solid)" }}>
            <p className="text-[13.5px] font-bold">Rasxod o&apos;chirilsinmi?</p>
            <p className="mt-1 text-[12px]" style={{ color: "var(--muted)" }}>
              «{confirmDel.destination}» — {fmt(expenseNum(confirmDel.amount))}. Hisob-kitobdagi «Rasxoddan keyingi foyda» darhol o&apos;zgaradi.
            </p>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => setConfirmDel(null)} className="btn-ghost !py-1.5 !text-[12.5px]">Bekor</button>
              <button onClick={doDelete} className="rounded-[11px] px-3 py-1.5 text-[12.5px] font-bold text-white" style={{ background: "var(--danger-ink)" }}>O&apos;chirish</button>
            </div>
          </div>
        </div>
      )}

      {(addFor || editItem) && (
        <ExpenseQuickAdd
          expense={editItem}
          day={addFor?.day ?? null}
          options={opts}
          onClose={() => { setAddFor(null); setEditItem(null); }}
          onSaved={() => { setAddFor(null); setEditItem(null); load(); }}
          onDelete={control && editItem ? () => setConfirmDel(editItem) : undefined}
        />
      )}
    </div>
  );
}
