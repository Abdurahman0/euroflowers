"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, Clock, Truck, Users } from "lucide-react";
import { api } from "@/lib/api";
import { stockBatchesCached } from "@/lib/reportCache";
import { useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { dateAfterParam, dateBeforeParam, fmt, initials } from "@/lib/format";
import { freshness } from "@/lib/inventory";
import { statusBadgeProps, statusName, sourceLabel, SourceBadge } from "@/components/badges";
import CountUp from "@/components/CountUp";
import DateChips from "@/components/DateChips";
import FlowerLoader from "@/components/FlowerLoader";
import MiniBloom from "@/components/MiniBloom";
import type { Customer, Dashboard, Lead, StockBatch } from "@/lib/types";

const fmtMoney = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const rise = {
  hidden: { opacity: 0, y: 20, filter: "blur(5px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
};

type Aux = { topCustomers: Customer[]; periodLeads: Lead[]; batches: StockBatch[]; deliveries: Lead[] };
const EMPTY_AUX: Aux = { topCustomers: [], periodLeads: [], batches: [], deliveries: [] };

export default function DashboardPage() {
  const router = useRouter();
  const { dateFilter, dateRange } = useStore();
  const [d, setD] = useState<Dashboard | null>(null);
  const [aux, setAux] = useState<Aux>(EMPTY_AUX);
  const [err, setErr] = useState("");

  // davr filtri (Bugun/7/30 yoki maxsus oraliq). `to` — INKLYUZIV; API qatlami moslaydi.
  const from = dateRange ? dateRange.from : dateAfterParam(dateFilter);
  const to = dateRange ? dateRange.to : ymd(new Date());
  const today = ymd(new Date());

  const load = useCallback(() => {
    api.dashboard({ from, to }).then(setD).catch((e) => setErr(e instanceof Error ? e.message : "Xatolik"));
    // yordamchi (client-signal) bloklar — har biri best-effort, alohida bo'sh holat
    Promise.allSettled([
      api.customers({ ordering: "-purchases_count" }),
      api.leads({ created_at_after: from, created_at_before: dateBeforeParam(to), page_size: 100 }),
      stockBatchesCached(),
      api.leads({ desired_date: today, page_size: 100 }),
    ]).then(([c, pl, b, dl]) => setAux({
      topCustomers: c.status === "fulfilled" ? c.value.slice(0, 5) : [],
      periodLeads: pl.status === "fulfilled" ? pl.value : [],
      batches: b.status === "fulfilled" ? b.value : [],
      // backend `desired_date=` filtri ishonchsiz (desired_date=null leadlarni ham
      // qaytaradi) — mijoz sanasini KLIENT tomonda aniq tekshiramiz (Buyurtmalar bilan bir xil)
      deliveries: dl.status === "fulfilled" ? dl.value.filter((l) => (l.desired_date ?? "").slice(0, 10) === today) : [],
    }));
  }, [from, to, today]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  // ── client signallari (davr leadlaridan) ─────────────────────────
  // QAYTGAN mijoz = bu davrdan OLDIN ham murojaati bo'lgan. Aniqrog'i:
  // mijozning umumiy leads_count'i shu davrdagi leadlaridan KO'P bo'lsa, demak
  // avval ham so'rov bergan (backend per-mijoz xarid tarixi bermaydi — Q eslatma
  // REPORTING_AUDIT.md). Bu «uzoq oldin yaratilgan, ammo endi birinchi marta
  // buyurtma bergan» mijozni to'g'ri «yangi» deb belgilaydi.
  const newReturning = useMemo(() => {
    const periodCount = new Map<number, number>(); // customerId → shu davrdagi lead soni
    const allTime = new Map<number, number>();       // customerId → umumiy leads_count
    for (const l of aux.periodLeads) {
      const c = l.customer_detail;
      if (!c) continue;
      periodCount.set(c.id, (periodCount.get(c.id) ?? 0) + 1);
      allTime.set(c.id, c.leads_count ?? 0);
    }
    let ret = 0;
    periodCount.forEach((pc, id) => { if ((allTime.get(id) ?? 0) > pc) ret++; });
    return { total: periodCount.size, returning: ret, fresh: periodCount.size - ret };
  }, [aux.periodLeads]);

  const sourceSplit = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of aux.periodLeads) m.set(l.source || "other", (m.get(l.source || "other") ?? 0) + 1);
    const total = aux.periodLeads.length || 1;
    return Array.from(m.entries()).map(([source, count]) => ({ source, count, pct: Math.round((count / total) * 100) })).sort((a, b) => b.count - a.count);
  }, [aux.periodLeads]);

  const lowStock = useMemo(
    () => aux.batches.filter((b) => b.is_active && b.remaining_stems > 0 && b.remaining_stems <= b.minimum_sale_stems * 2)
      .sort((a, b) => a.remaining_stems - b.remaining_stems),
    [aux.batches]
  );
  const wiltRisk = useMemo(
    () => aux.batches.filter((b) => b.is_active && b.remaining_stems > 0 && freshness(b.received_at).days >= 8)
      .sort((a, b) => freshness(b.received_at).days - freshness(a.received_at).days),
    [aux.batches]
  );

  if (err) return <p className="mt-10 text-center text-sm font-bold" style={{ color: "var(--danger-ink)" }}>{err}</p>;
  if (!d) return <FlowerLoader />;

  // OPERATSION KPI — mijoz/operatsiya fokusli; ATIGI BITTA pul raqami (bugungi savdo).
  const stats: { label: string; num: number; money?: boolean; suffix?: string; sub: string; href: string; dark?: boolean }[] = [
    { label: "Savdo (davr)", num: +(d.period_catalog_sales_revenue ?? d.catalog_sales_revenue_today ?? 0), money: true, sub: `haqiqiy katalog sotuvi · kutilayotgan: ${fmtMoney(+(d.period_lead_revenue ?? d.lead_revenue_today ?? 0))} so'm`, href: "/hisob-kitob", dark: true },
    { label: "Faol buyurtmalar", num: d.active_leads, sub: `${d.new_leads_today} tasi bugun tushdi`, href: "/buyurtmalar" },
    { label: "Konversiya", num: +d.conversion_rate, suffix: "%", sub: "so'rovdan sotuvga", href: "/analitika" },
    { label: "AI suhbatlar", num: d.ai_conversations, sub: `${d.operator_conversations} ta operatorda`, href: "/chat" },
    { label: "Katalogda sotuvda", num: d.available_catalog, sub: `${d.pending_deductions} ta chiqim kutilmoqda`, href: "/katalog" },
    { label: "Skladda gul", num: d.stock_stems, sub: `${d.low_stock} pozitsiya kam qoldi`, href: "/sklad" },
  ];
  const statBg = ["var(--side)", "var(--surface)", "var(--surface)", "var(--surface)", "var(--surface)", "var(--surface)"];
  const maxPipe = Math.max(...d.lead_pipeline.map((p) => p.count), 1);
  const nrMax = Math.max(newReturning.total, 1);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="relative">
      <motion.div variants={rise} className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold" style={{ color: "var(--text-2)" }}>Bugun nima bo&apos;lyapti</h2>
          <p className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>operatsion holat · mijozlar · diqqat talab qiladiganlar</p>
        </div>
        <DateChips />
      </motion.div>

      {/* OPERATSION KPI */}
      <motion.div variants={rise} className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        {stats.map((s, i) => (
          <Link key={s.label} href={s.href} className="glass-lite card-hover group relative block overflow-hidden p-4" style={{ background: statBg[i] }}>
            <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: s.dark ? "rgba(255,255,255,0.68)" : "var(--muted)" }}>{s.label}</div>
            <div className="mt-2 whitespace-nowrap text-[24px] font-semibold tracking-tight" style={{ color: s.dark ? "#ffffff" : "var(--text)" }}>
              <CountUp value={s.num} format={s.money ? fmtMoney : undefined} />{s.suffix}
            </div>
            <div className="mt-1 text-[13px] font-medium" style={{ color: s.dark ? "rgba(255,255,255,0.78)" : "var(--text-2)" }}>{s.sub}</div>
            <MiniBloom />
          </Link>
        ))}
      </motion.div>

      {/* MIJOZLAR — client signallari */}
      <motion.h3 variants={rise} className="mt-6 mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[1.5px]" style={{ color: "var(--primary)" }}>
        <Users size={15} strokeWidth={2.2} /> Mijozlar
      </motion.h3>
      <motion.div variants={rise} className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
        {/* yangi vs qaytgan */}
        <section className="glass-lite p-5">
          <h4 className="mb-3 flex items-center gap-1.5 text-[15px] font-bold" title="Qaytgan = bu davrdan oldin ham murojaati bo'lgan mijoz (umumiy so'rovlar soni shu davrdagidan ko'p). Backend per-mijoz xarid tarixini bermaganligi uchun so'rov (lead) tarixi asos qilinadi.">
            Yangi va qaytgan mijozlar
            <span className="cursor-help text-[11px] font-bold" style={{ color: "var(--muted)" }}>ⓘ</span>
          </h4>
          {newReturning.total === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>Bu davrda mijoz faoliyati yo&apos;q.</p>
          ) : (
            <>
              <div className="flex h-3 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                <div style={{ width: `${(newReturning.fresh / nrMax) * 100}%`, background: "var(--primary)" }} />
                <div style={{ width: `${(newReturning.returning / nrMax) * 100}%`, background: "var(--acc)" }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-[13px]">
                <span className="flex items-center gap-1.5 font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--primary)" }} /> Yangi <b>{newReturning.fresh}</b></span>
                <span className="flex items-center gap-1.5 font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--acc)" }} /> Qaytgan <b>{newReturning.returning}</b></span>
              </div>
              <p className="mt-2 text-[12px]" style={{ color: "var(--muted)" }}>Jami {newReturning.total} ta faol mijoz · avval ham so&apos;rovi bo&apos;lganlar &quot;qaytgan&quot;</p>
            </>
          )}
        </section>

        {/* manba bo'yicha */}
        <section className="glass-lite p-5">
          <h4 className="mb-3 text-[15px] font-bold">Manba bo&apos;yicha so&apos;rovlar</h4>
          {sourceSplit.length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>Bu davrda so&apos;rov yo&apos;q.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {sourceSplit.map((s) => (
                <div key={s.source} className="flex items-center gap-3">
                  <div className="w-[112px] shrink-0"><SourceBadge source={s.source} /></div>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                    <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: "linear-gradient(90deg, var(--acc), var(--accL))" }} />
                  </div>
                  <b className="w-9 text-right text-[13px] tabular-nums">{s.count}</b>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* top-5 mijoz */}
        <section className="glass-lite p-5">
          <h4 className="mb-3 text-[15px] font-bold">Eng faol mijozlar</h4>
          {aux.topCustomers.filter((c) => c.purchases_count > 0 || +c.total_spent > 0).length === 0 ? (
            <p className="text-[13px]" style={{ color: "var(--muted)" }}>Hali sotuv bilan mijoz yo&apos;q.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {aux.topCustomers.filter((c) => c.purchases_count > 0 || +c.total_spent > 0).map((c, i) => (
                <Link key={c.id} href={`/mijozlar?customer=${c.id}`} className="card-hover flex items-center gap-3 rounded-[12px] border p-2" style={{ borderColor: "var(--line2)" }}>
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold" style={{ background: i === 0 ? "var(--primary)" : "var(--surface-2)", color: i === 0 ? "#fff" : "var(--text-2)" }}>{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{c.name || `@${c.instagram_username}` || "Mijoz"}</span>
                  <span className="shrink-0 text-right text-[12px]" style={{ color: "var(--muted)" }}>{c.purchases_count} buyurtma<br /><b style={{ color: "var(--text-2)" }}>{fmt(c.total_spent)}</b></span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </motion.div>

      {/* DIQQAT TALAB QILADI — operatsion alertlar */}
      <motion.h3 variants={rise} className="mt-6 mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[1.5px]" style={{ color: "var(--danger-ink)" }}>
        <AlertTriangle size={15} strokeWidth={2.2} /> Diqqat talab qiladi
      </motion.h3>
      <motion.div variants={rise} className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))" }}>
        <AlertCard icon={<AlertTriangle size={15} strokeWidth={2.2} />} title="Kam qolgan partiyalar" count={lowStock.length} href="/sklad?tab=partiyalar&show=low" tone="var(--danger-ink)"
          rows={lowStock.slice(0, 4).map((b) => ({ id: b.id, main: `${b.variant_detail?.flower_detail?.name_uz ?? ""} ${b.variant_detail?.name_uz ?? ""}`.trim() || `№${b.batch_number}`, side: `${b.remaining_stems} dona` }))}
          empty="Hamma partiyada yetarli qoldiq bor." />
        <AlertCard icon={<Clock size={15} strokeWidth={2.2} />} title="So'lish xavfi (8+ kun)" count={wiltRisk.length} href="/sklad?tab=partiyalar&show=wilt" tone="var(--warning-ink)"
          rows={wiltRisk.slice(0, 4).map((b) => ({ id: b.id, main: `${b.variant_detail?.flower_detail?.name_uz ?? ""} ${b.variant_detail?.name_uz ?? ""}`.trim() || `№${b.batch_number}`, side: freshness(b.received_at).label }))}
          empty="So'lish xavfidagi partiya yo'q." />
        <AlertCard icon={<Truck size={15} strokeWidth={2.2} />} title="Bugungi yetkazishlar" count={aux.deliveries.length} href="/buyurtmalar?delivery=today" tone="var(--info)"
          rows={aux.deliveries.slice(0, 4).map((l) => ({ id: l.id, main: l.customer_detail?.name || `@${l.customer_detail?.instagram_username}` || "Mijoz", side: fmt(l.estimated_price) }))}
          empty="Bugunga rejalashtirilgan yetkazish yo'q." />
      </motion.div>

      {/* SO'NGGI BUYURTMALAR + PIPELINE */}
      <div className="mt-6 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))" }}>
        <motion.section variants={rise} className="glass-lite p-5">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[16px]">So&apos;nggi buyurtmalar</h2>
            <Link href="/buyurtmalar" className="text-[13px] font-bold" style={{ color: "var(--acc)" }}>Buyurtmalar →</Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {d.recent_leads.length === 0 && <p className="text-[13px]" style={{ color: "var(--muted)" }}>Hozircha buyurtma yo&apos;q.</p>}
            {d.recent_leads.slice(0, 5).map((l, i) => (
              <motion.div key={l.id} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => router.push(`/buyurtmalar?order=${l.id}`)} role="link" tabIndex={0}
                onKeyDown={(e) => e.key === "Enter" && router.push(`/buyurtmalar?order=${l.id}`)} title="Buyurtmani ochish"
                className="card-hover flex cursor-pointer items-center gap-3 rounded-[14px] border p-2.5" style={{ borderColor: "var(--line2)" }}>
                <div className="avatar-lead flex h-[38px] w-[38px] -rotate-3 items-center justify-center rounded-xl text-[14px] font-bold">
                  {initials(l.customer_detail?.name || l.customer_detail?.instagram_username || "?")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] font-bold">{l.customer_detail?.name || `@${l.customer_detail?.instagram_username}`}</div>
                  <div className="truncate text-xs" style={{ color: "var(--muted)" }}>{l.request_uz || l.request_ru}</div>
                </div>
                <div className="text-right">
                  <div className="text-[13px] font-bold">{fmt(l.estimated_price)}</div>
                  {(() => { const bp = statusBadgeProps(l.status, l.status_detail); return <span className={bp.className} style={bp.style}>{statusName(l.status, l.status_detail)}</span>; })()}
                </div>
              </motion.div>
            ))}
          </div>
        </motion.section>

        <motion.section variants={rise} className="glass-lite p-5">
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[16px]">Buyurtmalar oqimi</h2>
            <Link href="/buyurtmalar" className="text-[13px] font-bold" style={{ color: "var(--acc)" }}>Kanban →</Link>
          </div>
          <div className="flex flex-col gap-2.5">
            {d.lead_pipeline.map((p, i) => (
              <div key={p.status} className="flex items-center gap-3">
                {(() => { const bp = statusBadgeProps(p.status); return <span className={`${bp.className} w-[76px] text-center`} style={bp.style}>{statusName(p.status)}</span>; })()}
                <div className="h-[10px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(p.count / maxPipe) * 100}%` }} transition={{ delay: 0.4 + i * 0.1, duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
                    className="h-full rounded-full" style={{ background: "linear-gradient(90deg, var(--acc), var(--accL))" }} />
                </div>
                <b className="w-6 text-right text-[14px]">{p.count}</b>
              </div>
            ))}
            {d.lead_pipeline.length === 0 && <p className="text-[13px]" style={{ color: "var(--muted)" }}>Pipeline bo&apos;sh.</p>}
          </div>
        </motion.section>
      </div>
    </motion.div>
  );
}

/** Operatsion alert kartasi — ikonka + son + qisqa ro'yxat (bo'sh holat bilan). */
function AlertCard({ icon, title, count, href, tone, rows, empty }: {
  icon: React.ReactNode; title: string; count: number; href: string; tone: string;
  rows: { id: number; main: string; side: string }[]; empty: string;
}) {
  return (
    <Link href={href} className="glass-lite card-hover block p-5">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-2 text-[15px] font-bold"><span style={{ color: tone }}>{icon}</span> {title}</h4>
        <span className="rounded-full px-2.5 py-0.5 text-[13px] font-bold" style={{ background: count ? `color-mix(in srgb, ${tone} 15%, transparent)` : "var(--surface-2)", color: count ? tone : "var(--muted)" }}>{count}</span>
      </div>
      {rows.length === 0 ? (
        <p className="text-[13px]" style={{ color: "var(--muted)" }}>{empty}</p>
      ) : (
        <div className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center justify-between gap-2 text-[13px]">
              <span className="min-w-0 truncate font-medium">{r.main}</span>
              <span className="shrink-0 font-bold tabular-nums" style={{ color: "var(--text-2)" }}>{r.side}</span>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
}
