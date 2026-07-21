"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { dateAfterParam, fmt, fmtTime, initials } from "@/lib/format";
import { STATUS_BADGE, STATUS_LABEL } from "@/components/badges";
import CountUp from "@/components/CountUp";
import DateChips from "@/components/DateChips";
import FlowerLoader from "@/components/FlowerLoader";
import MiniBloom from "@/components/MiniBloom";
import type { Dashboard } from "@/lib/types";

const fmtMoney = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};
const rise = {
  hidden: { opacity: 0, y: 22, filter: "blur(5px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function DashboardPage() {
  const router = useRouter();
  const { dateFilter, dateRange } = useStore();
  const [d, setD] = useState<Dashboard | null>(null);
  const [err, setErr] = useState("");

  // davr filtri (Bugun/7/30 yoki maxsus oraliq) → /api/dashboard/?from&to
  const from = dateRange ? dateRange.from : dateAfterParam(dateFilter);
  const to = dateRange ? dateRange.to : ymd(new Date());

  const load = useCallback(() => {
    api.dashboard({ from, to }).then(setD).catch((e) => setErr(e instanceof Error ? e.message : "Xatolik"));
  }, [from, to]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load); // jimgina davriy yangilash — real vaqt hissi

  if (err) return <p className="mt-10 text-center text-sm font-bold" style={{ color: "var(--roseink, #a04a4a)" }}>{err}</p>;
  if (!d) return <FlowerLoader />;

  // dark=true — brend fonli kartalar (matn sof oq); qolganlari neytral yuzada
  const stats: { label: string; num: number; money?: boolean; sub: string; href: string; darkCard?: boolean }[] = [
    { label: "Bugungi savdo", num: +d.revenue_today, money: true, sub: `so'm · ${d.orders_today} ta buyurtma`, href: "/crm", darkCard: true },
    { label: "7 kunlik savdo", num: +d.revenue_7d, money: true, sub: `so'm · konversiya ${d.conversion_rate}%`, href: "/crm", darkCard: true },
    { label: "Faol leadlar", num: d.active_leads, sub: `${d.new_leads_today} tasi bugun tushdi`, href: "/crm" },
    { label: "AI suhbatlar", num: d.ai_conversations, sub: `${d.operator_conversations} ta operatorda`, href: "/chat" },
    { label: "Katalogda sotuvda", num: d.available_catalog, sub: `${d.pending_deductions} ta chiqim kutilmoqda`, href: "/katalog" },
    { label: "Skladda gul", num: d.stock_stems, sub: `${d.low_stock} pozitsiya kam qoldi`, href: "/sklad" },
  ];
  const statBg = ["var(--side)", "var(--primary)", "var(--surface)", "var(--surface)", "var(--surface)", "var(--surface)"];
  const maxPipe = Math.max(...d.lead_pipeline.map((p) => p.count), 1);

  // backend davr statistikasi (?from&to) — mavjud bo'lsa alohida qator
  const periodStats: { label: string; num: number; money?: boolean; sub?: string }[] =
    d.period_revenue !== undefined
      ? [
          { label: "Davr savdosi", num: +(d.period_revenue ?? 0), money: true, sub: `so'm · ${d.period_orders ?? 0} buyurtma` },
          { label: "Leadlar", num: d.period_leads ?? 0 },
          { label: "Yangi mijozlar", num: d.period_customers ?? 0 },
          { label: "Suhbatlar", num: d.period_conversations ?? 0 },
          { label: "Florist daromadi", num: +(d.florist_revenue ?? 0), money: true, sub: "so'm" },
          { label: "Sotilgan gul", num: d.flowers_sold_stems ?? 0, sub: "dona" },
        ]
      : [];

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="relative">
      <motion.div variants={rise} className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-[15px] font-bold" style={{ color: "var(--text-2)" }}>Davr statistikasi</h2>
        <DateChips />
      </motion.div>

      {periodStats.length > 0 && (
        <motion.div variants={rise} className="mb-4 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
          {periodStats.map((s) => (
            <div key={s.label} className="glass-lite p-3.5">
              <div className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{s.label}</div>
              <div className="mt-1 whitespace-nowrap text-[19px] font-semibold tracking-tight">
                <CountUp value={s.num} format={s.money ? fmtMoney : undefined} />
              </div>
              {s.sub && <div className="text-[12px] font-medium" style={{ color: "var(--text-2)" }}>{s.sub}</div>}
            </div>
          ))}
        </motion.div>
      )}

      <motion.div variants={rise} className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(205px,1fr))" }}>
        {stats.map((s, i) => (
          <Link key={s.label} href={s.href} className="glass-lite card-hover group relative block overflow-hidden p-4" style={{ background: statBg[i] }}>
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: s.darkCard ? "rgba(255,255,255,0.68)" : "var(--muted)" }}>
              {s.label}
            </div>
            <div className="mt-2 whitespace-nowrap text-[24px] font-semibold tracking-tight" style={{ color: s.darkCard ? "#ffffff" : "var(--text)" }}>
              <CountUp value={s.num} format={s.money ? fmtMoney : undefined} />
            </div>
            <div className="mt-1 text-[13px] font-medium" style={{ color: s.darkCard ? "rgba(255,255,255,0.78)" : "var(--text-2)" }}>
              {s.sub}
            </div>
            <MiniBloom />
          </Link>
        ))}
      </motion.div>

      <div className="mt-5 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))" }}>
        {/* so'nggi leadlar */}
        <motion.section variants={rise} className="glass-lite p-5">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[16px]">So&apos;nggi leadlar</h2>
            <Link href="/crm" className="text-[13px] font-bold" style={{ color: "var(--acc)" }}>CRM →</Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {d.recent_leads.length === 0 && <p className="text-[13px]" style={{ color: "var(--mut)" }}>Hozircha lead yo&apos;q.</p>}
            {d.recent_leads.slice(0, 5).map((l, i) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, x: -14 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.35 + i * 0.09, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => router.push(`/crm?lead=${l.id}`)}
                role="link"
                tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/crm?lead=${l.id}`)}
                title="CRM'da ochish"
                className="card-hover flex cursor-pointer items-center gap-3 rounded-[14px] border p-2.5"
                style={{ borderColor: "var(--line2)" }}
              >
                <div className="avatar-lead flex h-[38px] w-[38px] -rotate-3 items-center justify-center rounded-xl text-[14px] font-bold">
                  {initials(l.customer_detail?.name || l.customer_detail?.instagram_username || "?")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold" title={l.customer_detail?.name || `@${l.customer_detail?.instagram_username}`}>{l.customer_detail?.name || `@${l.customer_detail?.instagram_username}`}</div>
                  <div className="truncate text-xs" style={{ color: "var(--mut)" }}>{l.request_uz || l.request_ru}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-bold">{fmt(l.estimated_price)}</div>
                  <span className={STATUS_BADGE[l.status]}>{STATUS_LABEL[l.status]}</span>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <div className="flex flex-col gap-4">
          {/* lead pipeline — animatsiyali ustunlar */}
          <motion.section variants={rise} className="glass-lite p-5">
            <h2 className="mb-3.5 text-[16px]">Lead pipeline</h2>
            <div className="flex flex-col gap-2.5">
              {d.lead_pipeline.map((p, i) => (
                <div key={p.status} className="flex items-center gap-3">
                  <span className={`${STATUS_BADGE[p.status]} w-[76px] text-center`}>{STATUS_LABEL[p.status]}</span>
                  <div className="h-[10px] flex-1 overflow-hidden rounded-full bg-bg2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(p.count / maxPipe) * 100}%` }}
                      transition={{ delay: 0.5 + i * 0.12, duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, var(--acc), var(--accL))" }}
                    />
                  </div>
                  <b className="w-6 text-right text-[14px]">{p.count}</b>
                </div>
              ))}
              {d.lead_pipeline.length === 0 && <p className="text-[13px]" style={{ color: "var(--mut)" }}>Pipeline bo&apos;sh.</p>}
            </div>
          </motion.section>

          {/* diqqat */}
          <motion.section variants={rise} className="glass-lite reading-glass p-5">
            <h2 className="mb-3 text-[16px]">Diqqat talab qiladi</h2>
            <div className="flex flex-col gap-2">
              {d.recent_notifications.length === 0 && <p className="text-[13px]" style={{ color: "var(--mut)" }}>Hammasi joyida 🌷</p>}
              {d.recent_notifications.map((n) => (
                <div key={n.id} className="flex items-start gap-2.5 rounded-[13px] border bg-tint p-3" style={{ borderColor: "var(--line2)" }}>
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: "var(--acc)" }}>!</span>
                  <div className="flex-1">
                    <p className="text-[13px] font-bold leading-snug">{n.title_uz || n.title_ru}</p>
                    {(n.body_uz || n.body_ru) && <p className="text-[13px] leading-snug" style={{ color: "var(--mut)" }}>{n.body_uz || n.body_ru}</p>}
                    <p className="mt-0.5 text-[11px]" style={{ color: "var(--mut)" }}>{fmtTime(n.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.section>

          {/* filiallar bo'yicha sklad */}
          <motion.section variants={rise} className="glass-lite relative overflow-hidden p-5 text-[#F7F1E8]" style={{ background: "color-mix(in srgb, var(--side) 62%, transparent)" }}>
            <div className="absolute -right-8 -top-8 h-24 w-24 rounded-full border-[18px] opacity-30" style={{ borderColor: "var(--accL)" }} />
            <h2 className="text-[16px]" style={{ color: "#F7F1E8" }}>Filiallar bo&apos;yicha sklad</h2>
            <div className="mt-3.5 flex flex-wrap gap-2">
              {d.branch_stock.map((b) => (
                <Link key={b.branch__id} href="/sklad" className="rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 text-[13px] !text-[#F7F1E8] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/25">
                  {b.branch__name} · {b.stems.toLocaleString("ru")} dona · {b.batches} partiya
                </Link>
              ))}
            </div>
          </motion.section>
        </div>
      </div>
    </motion.div>
  );
}
