"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import SharedDataNotice from "@/components/SharedDataNotice";
import { Plus, Truck, Tag, CalendarClock } from "lucide-react";
import clsx from "clsx";
import { api } from "@/lib/api";
import { useStore, usePerm } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { fmt, fmtDate, dateAfterParam } from "@/lib/format";
import { Icon } from "@/components/icons";
import DateChips from "@/components/DateChips";
import SearchInput from "@/components/SearchInput";
import FilterSelect from "@/components/FilterSelect";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import PaymentProgressBar from "@/components/PaymentProgressBar";
import ReservationCreateDrawer from "@/components/ReservationCreateDrawer";
import ReservationDetailDrawer from "@/components/ReservationDetailDrawer";
import { ARRANGEMENT_LABEL } from "@/components/badges";
import { RESERVATION_STATUS_LABEL, PAYMENT_STATUS_LABEL, FULFILLMENT_LABEL, reservationUrgency, paymentProgress, todayYmd, addDays } from "@/lib/reservation";
import type { Reservation } from "@/lib/types";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const STATUS_HUE: Record<string, string> = { active: "var(--primary)", fulfilled: "var(--success-ink, #3d8a5f)", cancelled: "var(--muted)" };
const custName = (r: Reservation) => r.customer_detail?.name || r.customer_name || "Mijoz ko'rsatilmagan";
const URG_TINT: Record<string, string> = { today: "var(--acc)", overdue: "var(--danger-ink)", soon: "var(--primary)", future: "var(--text-2)", none: "var(--muted)" };

type Quick = "" | "today" | "tomorrow" | "overdue";

export default function BronlarPage() {
  const { showToast, dateFilter, dateRange } = useStore();
  const { canView } = usePerm();
  const allowed = canView("crm");
  const [rows, setRows] = useState<Reservation[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Reservation | null>(null);
  // server filtrlari
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [statusF, setStatusF] = useState("");
  const [payF, setPayF] = useState("");
  // klient filtrlari
  const [fulfillF, setFulfillF] = useState<"" | "delivery" | "pickup">("");
  const [quick, setQuick] = useState<Quick>("");

  const from = dateRange ? dateRange.from : dateAfterParam(dateFilter);
  const to = dateRange ? dateRange.to : ymd(new Date());
  const today = todayYmd();

  useEffect(() => { const t = setTimeout(() => setQ(search.trim()), 300); return () => clearTimeout(t); }, [search]);

  const load = useCallback(() => {
    if (!allowed) return;
    api.reservations({ ordering: "desired_date", status: statusF || undefined, payment_status: payF || undefined, search: q || undefined, page_size: 200 })
      .then((d) => { setRows(d); setErr(""); }).catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi")).finally(() => setLoading(false));
  }, [allowed, statusF, payF, q]);
  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  // KLIENT filtri: fulfillment + (quick urgency YOKI DateChips davri desired_date bo'yicha)
  const shown = useMemo(() => {
    let xs = rows ?? [];
    if (fulfillF) xs = xs.filter((r) => r.fulfillment === fulfillF);
    if (quick) {
      xs = xs.filter((r) => {
        const u = reservationUrgency(r.desired_date, today);
        return quick === "today" ? u === "today" : quick === "tomorrow" ? u === "soon" : u === "overdue";
      });
    } else {
      // davr picker — bron QACHON OLINGANI (created_at) bo'yicha. desired_date kelajakka qaraydi,
      // shu bois uni davr bilan qirqmaymiz (aks holda bo'lajak bronlar yo'qolardi). [[reservation-date-scoping]]
      xs = xs.filter((r) => { const c = (r.created_at || "").slice(0, 10); return !c || (c >= from && c <= to); });
    }
    return xs;
  }, [rows, fulfillF, quick, from, to, today]);

  // STAT STRIP — ko'rinayotgan faol bronlar bo'yicha; bugun/ertaga — butun to'plamdan
  const stats = useMemo(() => {
    const active = shown.filter((r) => r.status === "active");
    const expected = active.reduce((s, r) => s + Math.round(+(r.estimated_price ?? 0) || 0), 0);
    const paid = active.reduce((s, r) => s + Math.round(+(r.paid_amount ?? 0) || 0), 0);
    const remaining = active.reduce((s, r) => s + Math.round(+(r.remaining_amount ?? 0) || 0), 0);
    const all = rows ?? [];
    const todayN = all.filter((r) => r.status === "active" && reservationUrgency(r.desired_date, today) === "today").length;
    const tomorrowN = all.filter((r) => r.status === "active" && reservationUrgency(r.desired_date, today) === "soon").length;
    return { count: active.length, expected, paid, remaining, todayN, tomorrowN };
  }, [shown, rows, today]);

  if (!allowed) return <div className="p-8"><EmptyState title="Ruxsat yo'q" sub="Bu sahifa «crm» ruxsatini talab qiladi." /></div>;
  if (loading && !rows) return <FlowerLoader />;

  return (
    <div className="flex flex-col gap-5">
      <SharedDataNotice screen="bronlar" />
      {/* SARLAVHA + BOSH AMAL */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-[11px]" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}><Icon name="bronlar" size={18} /></span>
          <div>
            <h1 className="text-[18px] font-extrabold tracking-tight">Bronlar</h1>
            <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>Mijoz oldindan buyurtma beradi (zaklad) — keyin katalogdan sotiladi.</p>
          </div>
        </div>
        <button onClick={() => setCreateOpen(true)} className="btn-primary !flex-none px-4 py-2.5 text-[14px]"><Plus size={18} strokeWidth={1.75} /> Bron</button>
      </div>

      {/* STAT STRIP */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Faol bronlar" value={String(stats.count)} />
        <Stat label="Kutilayotgan summa" value={fmt(stats.expected)} />
        <Stat label="To'langan (zaklad)" value={fmt(stats.paid)} hue="var(--acc)" />
        <Stat label="Qolgan qarz" value={fmt(stats.remaining)} hue={stats.remaining > 0 ? "var(--danger-ink)" : "var(--success-ink, #3d8a5f)"} />
        <Stat label="Bugun / Ertaga" value={`${stats.todayN} / ${stats.tomorrowN}`} />
      </div>

      {/* DAVR + FILTRLAR */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DateChips />
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={search} onChange={setSearch} ariaLabel="Bron qidirish" placeholder="Mijoz, so'rov, telefon…" />
          <FilterSelect value={statusF} onChange={setStatusF} label="Holat" options={[{ value: "", label: "Barcha holat" }, ...(["active", "fulfilled", "cancelled"] as const).map((s) => ({ value: s, label: RESERVATION_STATUS_LABEL[s] }))]} />
          <FilterSelect value={payF} onChange={setPayF} label="To'lov" options={[{ value: "", label: "Barcha to'lov" }, ...(["unpaid", "deposit", "paid"] as const).map((s) => ({ value: s, label: PAYMENT_STATUS_LABEL[s] }))]} />
          <FilterSelect value={fulfillF} onChange={(v) => setFulfillF(v as "" | "delivery" | "pickup")} label="Yetkazish" options={[{ value: "", label: "Hammasi" }, { value: "delivery", label: "Yetkazish" }, { value: "pickup", label: "Olib ketish" }]} />
        </div>
      </div>

      {/* QUICK CHIPS — desired_date bo'yicha */}
      <div className="flex flex-wrap items-center gap-1.5">
        {([["", "Barchasi"], ["today", "Bugun"], ["tomorrow", "Ertaga"], ["overdue", "Muddati o'tgan"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => setQuick(k)} aria-pressed={quick === k}
            className={clsx("rounded-full border-[1.5px] px-3.5 py-1.5 text-[12.5px] font-bold transition-colors", quick === k ? "text-white" : "")}
            style={quick === k ? { background: k === "overdue" ? "var(--danger-ink)" : "var(--primary)", borderColor: k === "overdue" ? "var(--danger-ink)" : "var(--primary)" } : { borderColor: "var(--line)", color: "var(--mut)" }}>
            {l}
          </button>
        ))}
      </div>

      {/* LIST */}
      {err ? <EmptyState title="Yuklab bo'lmadi" sub={err} />
        : shown.length === 0 ? <EmptyState title="Bron yo'q" sub="Bu davr/filtrda bron topilmadi. «+ Bron» orqali yangi bron qo'shing." />
        : (
          <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))" }}>
            {shown.map((r) => {
              const urg = reservationUrgency(r.desired_date, today);
              const prog = paymentProgress(r.paid_amount, r.estimated_price);
              const cancelled = r.status === "cancelled";
              return (
                <article key={r.id} onClick={() => setDetail(r)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === "Enter") setDetail(r); }}
                  className="glass card-hover flex cursor-pointer flex-col gap-2.5 !rounded-[18px] p-4" style={{ opacity: cancelled ? 0.6 : 1 }}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[15px] font-bold" title={custName(r)}>{custName(r)}</div>
                      {(r.customer_detail?.masked_phone || r.customer_phone) && <div className="truncate text-[11.5px]" style={{ color: "var(--muted)" }}>{r.customer_detail?.masked_phone || r.customer_phone}</div>}
                    </div>
                    <span className="shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: `color-mix(in srgb, ${STATUS_HUE[r.status]} 15%, transparent)`, color: STATUS_HUE[r.status] }}>{RESERVATION_STATUS_LABEL[r.status]}</span>
                  </div>
                  <p className="line-clamp-2 text-[12.5px] leading-snug" style={{ color: "var(--text-2)" }} title={r.request_uz}>{r.request_uz || "—"}</p>
                  <div className="flex flex-wrap items-center gap-2 text-[11.5px] font-semibold">
                    <span className="rounded-full bg-sfc px-2.5 py-0.5" style={{ color: "var(--text-2)" }}>{r.arrangement_type ? ARRANGEMENT_LABEL[r.arrangement_type as "bouquet"] ?? r.arrangement_type : "—"}</span>
                    {r.fulfillment && <span className="flex items-center gap-1 rounded-full bg-sfc px-2.5 py-0.5" style={{ color: "var(--text-2)" }}>{r.fulfillment === "delivery" ? <Truck size={11} /> : <Tag size={11} />}{FULFILLMENT_LABEL[r.fulfillment as "delivery" | "pickup"]}</span>}
                    {r.desired_date && <span className="flex items-center gap-1 rounded-full px-2.5 py-0.5" style={{ background: "var(--hover)", color: URG_TINT[urg] }}><CalendarClock size={11} strokeWidth={2.2} />{fmtDate(r.desired_date)}{r.desired_time ? ` · ${r.desired_time.slice(0, 5)}` : ""}{urg === "overdue" ? " · o'tgan" : urg === "today" ? " · bugun" : ""}</span>}
                  </div>
                  <div className="mt-auto border-t pt-2.5" style={{ borderColor: "var(--line2)" }}>
                    <PaymentProgressBar paid={r.paid_amount} total={r.estimated_price} size="sm" compact />
                  </div>
                </article>
              );
            })}
          </div>
        )}

      {createOpen && <ReservationCreateDrawer onClose={() => setCreateOpen(false)} onSaved={(r) => { setCreateOpen(false); load(); setDetail(r); showToast("✓ Bron yaratildi"); }} />}
      {detail && <ReservationDetailDrawer reservation={detail} onClose={() => setDetail(null)} onChanged={(r) => { setDetail(r); setRows((rs) => (rs ?? []).map((x) => (x.id === r.id ? r : x))); }} />}
    </div>
  );
}

function Stat({ label, value, hue }: { label: string; value: string; hue?: string }) {
  return (
    <div className="glass-lite flex flex-col justify-center !rounded-[16px] p-3.5">
      <div className="truncate text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="mt-1 truncate text-[17px] font-extrabold tabular-nums" style={{ color: hue ?? "var(--text)" }}>{value}</div>
    </div>
  );
}
