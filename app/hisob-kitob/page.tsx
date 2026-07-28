"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, CreditCard, Download, Tag } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { usePerm, useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { fmt, fmtDate, dateAfterParam } from "@/lib/format";
import { KIND_LABEL, VOLUME_LABEL } from "@/lib/inventory";
import { exportAccountingByDay } from "@/lib/exports";
import { HBars } from "@/components/AnalyticsCharts";
import DateChips from "@/components/DateChips";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import type { Accounting, AccountingSale } from "@/lib/types";

/**
 * HISOB-KITOB — admin sotuv/foyda/chegirma xulosalari (GET /api/accounting/).
 * Davr filtri (DateChips), KPI kartalar, turi/to'lov/hajm bo'yicha taqsimot,
 * sotuvlar tarixi va chegirmali sotuvlar. Excel eksport (profit).
 * Barcha pul maydonlari STRING — fmt() o'giradi. date_to INKLYUZIV (kun oxiri).
 */

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function Kpi({ label, value, sub, hue }: { label: string; value: string; sub?: string; hue?: string }) {
  return (
    <div className="glass !rounded-[16px] p-4">
      <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="mt-1.5 whitespace-nowrap text-[21px] font-extrabold tracking-tight" style={{ color: hue ?? "var(--text)" }}>{value}</div>
      {sub && <div className="mt-0.5 text-[12px] font-medium" style={{ color: "var(--text-2)" }}>{sub}</div>}
    </div>
  );
}

const PAY_ICON: Record<string, typeof Banknote> = { cash: Banknote, card: CreditCard };
const PAY_HUE: Record<string, string> = { cash: "#3d8a5f", card: "var(--primary)" };

export default function HisobKitobPage() {
  const { dateFilter, dateRange, showToast } = useStore();
  const { canView } = usePerm();
  const visible = canView("dashboard");
  const [data, setData] = useState<Accounting | null>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState<"all" | "discount">("all");
  const [exporting, setExporting] = useState(false);

  const from = dateRange ? dateRange.from : dateAfterParam(dateFilter);
  const to = dateRange ? dateRange.to : ymd(new Date());

  const load = useCallback(() => {
    if (!visible) return;
    // date_to INKLYUZIV (jonli tekshirilgan) — dashboard'dan farqli, +1 kun EMAS
    api.accounting({ date_from: from, date_to: to })
      .then((d) => { setData(d); setErr(""); })
      .catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi"));
  }, [visible, from, to]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);
  // katalog sotilganda darhol yangilanadi
  useEffect(() => {
    const on = () => load();
    window.addEventListener("ef:stock-changed", on);
    return () => window.removeEventListener("ef:stock-changed", on);
  }, [load]);

  const doExport = async () => {
    if (!data) return;
    setExporting(true);
    try {
      // KLIENT eksport — yuklangan hisob-kitob ma'lumotidan (qayta so'rovsiz)
      await exportAccountingByDay(data, from, to);
      showToast("✓ Excel yuklab olindi");
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Eksport qilib bo'lmadi");
    } finally {
      setExporting(false);
    }
  };

  const volRows = useMemo(
    () => (data?.by_volume ?? [])
      .slice()
      .sort((a, b) => +b.sales - +a.sales)
      .map((v) => ({
        label: `${KIND_LABEL[v.catalog_kind] ?? v.catalog_kind}${v.volume ? ` · ${VOLUME_LABEL[v.volume] ?? v.volume}` : ""}`,
        value: +v.sales,
        sub: `${v.quantity} ta${+v.discount > 0 ? ` · chegirma ${fmt(v.discount)}` : ""}`,
      })),
    [data]
  );

  if (!visible) return <EmptyState title="Ruxsat yo'q" sub="Bu sahifa uchun sizda ko'rish huquqi yo'q." />;
  if (err) return <p className="mt-10 text-center text-sm font-bold" style={{ color: "var(--danger-ink)" }}>{err}</p>;
  if (!data) return <FlowerLoader />;

  const s = data.summary;
  const netProfit = +s.net_profit;
  const rows: AccountingSale[] = (tab === "discount" ? data.discounted_sales : data.history);
  const maxPay = Math.max(...data.by_payment.map((p) => +p.sales), 1);

  return (
    <div className="flex flex-col gap-4">
      {/* sarlavha + davr + eksport */}
      <div className="flex flex-wrap items-center gap-2">
        <p className="note-chip text-[14px]" style={{ color: "var(--mut)" }}>
          Hisob-kitob — davr bo&apos;yicha sotuv, foyda va chegirmalar
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <DateChips />
          <button
            onClick={doExport}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-[13px] border-[1.5px] px-3.5 py-2 text-[13px] font-bold transition-colors duration-150 hover:bg-[var(--hover)] disabled:opacity-60"
            style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }}
          >
            <Download size={15} strokeWidth={2} /> {exporting ? "Yuklanmoqda…" : "Excel"}
          </button>
        </div>
      </div>

      {/* KPI kartalar */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))" }}>
        <Kpi label="Umumiy savdo" value={fmt(s.total_sales)} sub={`${s.total_quantity} ta sotuv`} hue="var(--acc)" />
        <Kpi label="Naqd" value={fmt(s.cash_total)} hue="#3d8a5f" />
        <Kpi label="Karta" value={fmt(s.card_total)} hue="var(--primary)" />
        <Kpi label="Sof foyda" value={fmt(s.net_profit)} sub={`tannarx ${fmt(s.cost_total)}`} hue={netProfit >= 0 ? "var(--success-ink, #3d8a5f)" : "var(--danger-ink)"} />
        <Kpi label="Umumiy chegirma" value={fmt(s.discount_total)} sub={`${s.discounted_sales_count} ta chegirmali`} hue="var(--danger-ink)" />
      </div>

      {/* turi + to'lov taqsimoti */}
      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* by_kind */}
        <section className="glass !rounded-[20px] p-5">
          <h2 className="text-[15px] font-bold tracking-tight">Turi bo&apos;yicha</h2>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--muted)" }}>standart va maxsus katalog</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            {data.by_kind.map((k) => (
              <div key={k.catalog_kind} className="rounded-[14px] border p-3.5" style={{ borderColor: "var(--border)" }}>
                <div className="text-[12px] font-bold" style={{ color: "var(--muted)" }}>{KIND_LABEL[k.catalog_kind] ?? k.catalog_kind}</div>
                <div className="mt-1 text-[18px] font-extrabold tracking-tight">{fmt(k.sales)}</div>
                <div className="mt-0.5 text-[12px]" style={{ color: "var(--text-2)" }}>
                  {k.quantity} ta{+k.discount > 0 ? ` · chegirma ${fmt(k.discount)}` : ""}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* by_payment */}
        <section className="glass !rounded-[20px] p-5">
          <h2 className="text-[15px] font-bold tracking-tight">To&apos;lov bo&apos;yicha</h2>
          <p className="mt-0.5 text-[12px]" style={{ color: "var(--muted)" }}>naqd va karta ulushi</p>
          <div className="mt-3 flex flex-col gap-3">
            {data.by_payment.filter((p) => +p.sales > 0 || p.payment_type === "cash" || p.payment_type === "card").map((p) => {
              const PIcon = PAY_ICON[p.payment_type] ?? Tag;
              const hue = PAY_HUE[p.payment_type] ?? "var(--muted)";
              const pct = Math.round((+p.sales / maxPay) * 100);
              return (
                <div key={p.payment_type}>
                  <div className="mb-1 flex items-center justify-between gap-2 text-[13px]">
                    <span className="flex items-center gap-2 font-semibold">
                      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-white" style={{ background: hue }}>
                        <PIcon size={12} strokeWidth={2.2} />
                      </span>
                      {p.label}
                    </span>
                    <span className="tabular-nums font-bold">
                      {fmt(p.sales)} <span className="font-medium" style={{ color: "var(--muted)" }}>· {p.quantity} ta</span>
                    </span>
                  </div>
                  <div className="h-[8px] overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                    <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${pct}%`, background: hue }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* hajm bo'yicha */}
      {volRows.length > 0 && (
        <section className="glass !rounded-[20px] p-5">
          <h2 className="text-[15px] font-bold tracking-tight">Hajm bo&apos;yicha sotuvlar</h2>
          <p className="mt-0.5 mb-3 text-[12px]" style={{ color: "var(--muted)" }}>so&apos;mda, turi va hajm kesimida</p>
          <HBars rows={volRows} format={(v) => fmt(v)} color="var(--chart-2)" />
        </section>
      )}

      {/* sotuvlar tarixi / chegirmalar */}
      <section className="glass overflow-hidden !rounded-[20px]">
        <div className="flex flex-wrap items-center gap-2 border-b-[1.5px] px-4 py-3" style={{ borderColor: "var(--line)" }}>
          {([["all", `Sotuvlar tarixi (${data.history.length})`], ["discount", `Chegirmalar (${data.discounted_sales.length})`]] as const).map(([t, lbl]) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className="rounded-full border-[1.5px] px-4 py-1.5 text-[12.5px] font-bold transition-colors"
              style={tab === t ? { background: "var(--acc)", borderColor: "var(--acc)", color: "#fff" } : { borderColor: "var(--line)", color: "var(--mut)" }}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div className="max-md:overflow-x-auto">
          <div className="grid min-w-[900px] grid-cols-[130px_1.4fr_1fr_100px_70px_1fr_1.2fr] gap-2.5 bg-tint px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-tintink">
            <span>Sotilgan</span><span>Katalog</span><span>Florist</span><span>To&apos;lov</span><span>Soni</span><span>Sotuv</span><span>Chegirma</span>
          </div>
          {rows.map((r, i) => {
            const PIcon = PAY_ICON[r.payment_type] ?? Tag;
            const disc = +r.discount_amount;
            return (
              <div
                key={r.history_id}
                className="row-lux grid min-w-[900px] grid-cols-[130px_1.4fr_1fr_100px_70px_1fr_1.2fr] items-center gap-2.5 border-t px-4 py-3 text-[13px]"
                style={{ borderColor: "var(--line2)", animationDelay: `${Math.min(i * 25, 350)}ms` }}
              >
                <span style={{ color: "var(--text-2)" }} title={`Katalogga: ${fmtDate(r.catalog_created_at)}`}>{fmtDate(r.sold_at)}</span>
                <span className="min-w-0">
                  <span className="block truncate font-semibold" title={r.catalog_name}>{r.catalog_name}</span>
                  <span className="text-[11.5px]" style={{ color: "var(--muted)" }}>
                    {KIND_LABEL[r.catalog_kind] ?? r.catalog_kind}{r.volume ? ` · ${VOLUME_LABEL[r.volume] ?? r.volume}` : ""}
                  </span>
                </span>
                <span className="min-w-0 truncate" style={{ color: "var(--text-2)" }} title={r.florist_name || r.sold_by}>
                  {r.florist_name || <span style={{ color: "var(--muted)" }}>—</span>}
                </span>
                <span className="flex items-center gap-1.5" style={{ color: PAY_HUE[r.payment_type] ?? "var(--text-2)" }}>
                  <PIcon size={13} strokeWidth={2} /> {r.payment_label}
                </span>
                <span className="font-semibold tabular-nums">{r.quantity}</span>
                <span className="tabular-nums font-bold" style={{ color: "var(--acc)" }}>{fmt(r.sale_total)}</span>
                <span className="min-w-0">
                  {disc > 0 ? (
                    <span className="flex min-w-0 flex-col">
                      <span className="tabular-nums font-bold" style={{ color: "var(--danger-ink)" }}>−{fmt(disc)} ({Math.round(+r.discount_percent * 10) / 10}%)</span>
                      {r.discount_reason && <span className="truncate text-[11.5px] italic" style={{ color: "var(--muted)" }} title={r.discount_reason}>{r.discount_reason}</span>}
                    </span>
                  ) : (
                    <span style={{ color: "var(--muted)" }}>—</span>
                  )}
                </span>
              </div>
            );
          })}
          {rows.length === 0 && (
            <EmptyState
              title={tab === "discount" ? "Chegirmali sotuv yo'q" : "Sotuv tarixi bo'sh"}
              sub="Tanlangan davrda sotuv qayd etilmagan — davrni kengaytirib ko'ring."
            />
          )}
        </div>
      </section>
    </div>
  );
}
