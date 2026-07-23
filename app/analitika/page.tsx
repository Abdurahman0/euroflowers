"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { HugeiconsIcon } from "@hugeicons/react";
import { InstagramIcon, TelegramIcon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { dateAfterParam, fmt } from "@/lib/format";
import { statusName, ARRANGEMENT_LABEL } from "@/components/badges";
import CountUp from "@/components/CountUp";
import DateChips from "@/components/DateChips";
import DailyChart from "@/components/DailyChart";
import { DonutChart, HBars, RevenueBars } from "@/components/AnalyticsCharts";
import FlowerLoader from "@/components/FlowerLoader";
import type { Analytics, LeadStatusDef } from "@/lib/types";

/**
 * Analitika — GET /api/analytics/ (dashboard ko'rish ruxsati bilan).
 * Minimal, zamonaviy: xulosa plitkalari → kunlik dinamika (soni + daromad
 * ALOHIDA grafiklarda: bitta o'q qoidasi) → reytinglar va taqsimotlar.
 */

const fmtMoney = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const rise = {
  hidden: { opacity: 0, y: 18, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

const SOURCE_META: Record<string, { label: string; bg: string; icon: typeof InstagramIcon }> = {
  instagram: { label: "Instagram", bg: "linear-gradient(45deg, #f9ce34, #ee2a7b, #6228d7)", icon: InstagramIcon },
  telegram: { label: "Telegram", bg: "#229ED9", icon: TelegramIcon },
  mini_app: { label: "Mini app", bg: "var(--primary)", icon: SmartPhone01Icon },
};

function Card({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.section variants={rise} className={`glass-lite p-5 ${className}`}>
      <div className="mb-3.5">
        <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
        {sub && <p className="mt-0.5 text-[12px] font-medium" style={{ color: "var(--muted)" }}>{sub}</p>}
      </div>
      {children}
    </motion.section>
  );
}

export default function AnalitikaPage() {
  const { dateFilter, dateRange } = useStore();
  const [a, setA] = useState<Analytics | null>(null);
  const [statuses, setStatuses] = useState<LeadStatusDef[]>([]);
  const [err, setErr] = useState("");

  const from = dateRange ? dateRange.from : dateAfterParam(dateFilter);
  const to = dateRange ? dateRange.to : ymd(new Date());

  const load = useCallback(() => {
    api.analytics({ from, to }).then(setA).catch((e) => setErr(e instanceof Error ? e.message : "Xatolik"));
    api.leadStatuses().then((s) => s.length && setStatuses(s)).catch(() => {});
  }, [from, to]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load); // jimgina davriy yangilash — real vaqt hissi

  if (err) return <p className="mt-10 text-center text-sm font-bold" style={{ color: "var(--danger-ink)" }}>{err}</p>;
  if (!a) return <FlowerLoader />;

  const s = a.summary;
  const tiles: { label: string; num: number; money?: boolean; sub?: string }[] = [
    { label: "Daromad", num: +s.revenue, money: true, sub: `so'm · ${s.orders} ta sotuv` },
    { label: "So'rovlar", num: s.leads, sub: `konversiya ${s.conversion_rate}%` },
    { label: "Suhbatlar", num: s.conversations },
    { label: "Yangi mijozlar", num: s.customers },
    { label: "Florist daromadi", num: +s.florist_revenue, money: true, sub: "so'm" },
    { label: "Sotilgan gul", num: s.flowers_sold_stems, sub: "dona" },
  ];

  const statusRows = a.lead_statuses
    .slice()
    .sort((x, y) => y.count - x.count)
    .map((r) => {
      const det = statuses.find((st) => st.key === r.status);
      return { label: statusName(r.status, det), value: r.count, color: det?.color };
    });

  const totalConvSrc = Math.max(a.conversation_sources.reduce((t, r) => t + r.count, 0), 1);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="relative flex flex-col gap-4">
      {/* sarlavha + davr */}
      <motion.div variants={rise} className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold" style={{ color: "var(--text-2)" }}>Davr analitikasi</h2>
        <DateChips />
      </motion.div>

      {/* xulosa plitkalari */}
      <motion.div variants={rise} className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))" }}>
        {tiles.map((t) => (
          <div key={t.label} className="glass-lite p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{t.label}</div>
            <div className="mt-1.5 whitespace-nowrap text-[22px] font-semibold tracking-tight">
              <CountUp value={t.num} format={t.money ? fmtMoney : undefined} />
            </div>
            {t.sub && <div className="mt-0.5 text-[12px] font-medium" style={{ color: "var(--text-2)" }}>{t.sub}</div>}
          </div>
        ))}
      </motion.div>

      {/* kunlik dinamika: sonlar (3 seriya) va daromad — ALOHIDA grafiklar */}
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card title="Kunlik faollik" sub="so'rovlar, suhbatlar va sotuvlar soni">
          <DailyChart
            data={a.daily_stats}
            series={[
              { key: "leads", label: "So'rovlar", varName: "var(--chart-1)" },
              { key: "conversations", label: "Suhbatlar", varName: "var(--chart-2)" },
              { key: "orders", label: "Sotuvlar", varName: "var(--chart-3)" },
            ]}
          />
        </Card>
        <Card title="Kunlik daromad" sub="so'mda, sotuvlar bo'yicha">
          <RevenueBars data={a.daily_stats} />
        </Card>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {/* eng ko'p sotilgan gullar */}
        <Card title="Eng ko'p sotilgan gullar" sub="dona bo'yicha, tanlangan davr">
          <HBars
            rows={a.top_selling_flowers.map((f) => ({
              label: `${f.name_uz}${f.color_uz ? ` — ${f.color_uz}` : ""}`,
              value: f.stems,
              sub: `${f.bunches} pochka`,
            }))}
            unit="dona"
          />
        </Card>

        {/* eng ko'p sotilgan katalog gullari */}
        <Card title="Top katalog gullari" sub="sotuv soni va daromadi">
          <HBars
            rows={a.top_catalog_items.map((c) => ({
              label: c.catalog_item__name_uz || c.catalog_item__name_ru,
              value: c.quantity,
              sub: `${ARRANGEMENT_LABEL[c.catalog_item__arrangement_type] ?? c.catalog_item__arrangement_type} · ${fmt(c.revenue)}`,
            }))}
            unit="ta"
            color="var(--chart-2)"
          />
        </Card>

        {/* buyurtmalar holati — donut, har status o'z rangida */}
        <Card title="Buyurtmalar holati" sub="statuslar bo'yicha taqsimot">
          <DonutChart
            slices={statusRows.map((r, i) => ({
              label: r.label,
              value: r.value,
              color: r.color ?? ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--muted)"][i % 4],
            }))}
            centerSub="buyurtma"
          />
        </Card>

        {/* buyurtma turlari */}
        <Card title="Buyurtma turlari" sub="buket / savat / donalab / katalog">
          <HBars
            rows={a.arrangement_types
              .slice()
              .sort((x, y) => y.count - x.count)
              .map((r) => ({ label: ARRANGEMENT_LABEL[r.arrangement_type] ?? r.arrangement_type ?? "Boshqa", value: r.count }))}
            unit="ta"
            color="var(--chart-3)"
          />
        </Card>

        {/* suhbat manbalari — platforma brendida */}
        <Card title="Suhbat manbalari" sub="qaysi kanaldan kelmoqda">
          <div className="flex flex-col gap-3">
            {a.conversation_sources
              .slice()
              .sort((x, y) => y.count - x.count)
              .map((r) => {
                const meta = SOURCE_META[r.source] ?? { label: r.source, bg: "var(--muted)", icon: SmartPhone01Icon };
                const share = Math.round((r.count / totalConvSrc) * 100);
                return (
                  <div key={r.source}>
                    <div className="mb-1 flex items-center justify-between gap-3">
                      <span className="flex items-center gap-2 text-[13px] font-semibold">
                        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-white" style={{ background: meta.bg }}>
                          <HugeiconsIcon icon={meta.icon} size={12} strokeWidth={2} />
                        </span>
                        {meta.label}
                      </span>
                      <span className="text-[13px] font-bold tabular-nums">
                        {r.count} <span className="font-medium" style={{ color: "var(--muted)" }}>· {share}%</span>
                      </span>
                    </div>
                    <div className="h-[8px] overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                      <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${share}%`, background: meta.bg }} />
                    </div>
                  </div>
                );
              })}
            {a.conversation_sources.length === 0 && <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>Ma&apos;lumot yo&apos;q.</p>}
          </div>
        </Card>

        {/* manbalar bo'yicha daromad */}
        <Card title="Manbalar bo'yicha daromad" sub="qaysi kanal qancha keltirdi">
          <HBars
            rows={a.revenue_by_source
              .slice()
              .sort((x, y) => +y.revenue - +x.revenue)
              .map((r) => ({
                label: SOURCE_META[r.source]?.label ?? r.source,
                value: +r.revenue,
                sub: `${r.orders} ta sotuv`,
              }))}
            format={(v) => `${fmtMoney(v)} so'm`}
            color="var(--chart-2)"
          />
        </Card>
      </div>
    </motion.div>
  );
}
