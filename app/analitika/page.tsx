"use client";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Download, TrendingDown, TrendingUp } from "lucide-react";
import { HugeiconsIcon } from "@hugeicons/react";
import { InstagramIcon, TelegramIcon, SmartPhone01Icon } from "@hugeicons/core-free-icons";
import { api, ApiError } from "@/lib/api";
import { accountingCached } from "@/lib/reportCache";
import { useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import Link from "next/link";
import { dateAfterParam, dateBeforeParam, fmt, fmtDate } from "@/lib/format";
import { VOLUME_LABEL, KIND_LABEL } from "@/lib/inventory";
import { excludeTest } from "@/lib/finance";
import { exportAccountingByDay } from "@/lib/exports";
import { ARRANGEMENT_LABEL } from "@/components/badges";
import CountUp from "@/components/CountUp";
import DateChips from "@/components/DateChips";
import DailyChart from "@/components/DailyChart";
import { HBars } from "@/components/AnalyticsCharts";
import FlowerLoader from "@/components/FlowerLoader";
import type { Accounting, Analytics, StockMovement } from "@/lib/types";

/**
 * Analitika — GET /api/analytics/ (dashboard ko'rish ruxsati bilan).
 * VAQT bo'yicha TRENDLAR va TAQQOSLASHLAR: davr vs oldingi davr deltalari,
 * kunlik savdo/konversiya/o'rtacha chek trendlari, mahsulot va kanal analitikasi,
 * chiqit foizi trendi. Xom moliyaviy ro'yxatlar — Hisob-kitobda.
 */

const fmtMoney = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const shiftYmd = (s: string, delta: number) => { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + delta); return ymd(d); };
const daysInclusive = (a: string, b: string) => Math.max(1, Math.round((+new Date(b + "T00:00:00") - +new Date(a + "T00:00:00")) / 86400000) + 1);

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const rise = { hidden: { opacity: 0, y: 18, filter: "blur(4px)" }, show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } } };

const SOURCE_META: Record<string, { label: string; bg: string; icon: typeof InstagramIcon }> = {
  instagram: { label: "Instagram", bg: "linear-gradient(45deg, #f9ce34, #ee2a7b, #6228d7)", icon: InstagramIcon },
  telegram: { label: "Telegram", bg: "#229ED9", icon: TelegramIcon },
  mini_app: { label: "Mini app", bg: "var(--primary)", icon: SmartPhone01Icon },
};

function Card({ title, sub, children, className = "" }: { title: string; sub?: string; children: React.ReactNode; className?: string }) {
  return (
    <motion.section variants={rise} className={`glass-lite p-5 ${className}`}>
      <div className="mb-3.5"><h2 className="text-[15px] font-bold tracking-tight">{title}</h2>{sub && <p className="mt-0.5 text-[12px] font-medium" style={{ color: "var(--muted)" }}>{sub}</p>}</div>
      {children}
    </motion.section>
  );
}

/** Davr-vs-davr delta belgisi. goodUp=false — kamayish yaxshi (masalan chiqit). */
function Delta({ cur, prev, goodUp = true }: { cur: number; prev: number; goodUp?: boolean }) {
  if (prev <= 0) {
    if (cur <= 0) return <span className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>— oldingi davr yo&apos;q</span>;
    // 0 dan o'sish: goodUp bo'lsa yaxshi (yashil), aks holda yomon (masalan chiqit — qizil)
    return <span className="text-[11px] font-bold" style={{ color: goodUp ? "var(--success-ink)" : "var(--danger-ink)" }}>yangi</span>;
  }
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return <span className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>0% o&apos;zgarish</span>;
  const up = pct > 0;
  const good = goodUp ? up : !up;
  const color = good ? "var(--success-ink)" : "var(--danger-ink)";
  return (
    <span className="flex items-center gap-1 text-[11.5px] font-bold" style={{ color }} title="oldingi teng davrga nisbatan">
      {up ? <TrendingUp size={12} strokeWidth={2.4} /> : <TrendingDown size={12} strokeWidth={2.4} />}
      {up ? "+" : ""}{pct}%
    </span>
  );
}

export default function AnalitikaPage() {
  const { dateFilter, dateRange, showToast } = useStore();
  const [a, setA] = useState<Analytics | null>(null);
  const [prev, setPrev] = useState<Analytics | null>(null);
  const [acc, setAcc] = useState<Accounting | null>(null);
  const [wasteNow, setWasteNow] = useState<StockMovement[]>([]);
  const [wastePrev, setWastePrev] = useState<StockMovement[]>([]);
  const [err, setErr] = useState("");
  const [exporting, setExporting] = useState(false);

  const from = dateRange ? dateRange.from : dateAfterParam(dateFilter);
  const to = dateRange ? dateRange.to : ymd(new Date());
  // oldingi teng uzunlikdagi davr (deltalar uchun)
  const len = daysInclusive(from, to);
  const prevTo = shiftYmd(from, -1);
  const prevFrom = shiftYmd(prevTo, -(len - 1));

  const doExport = async () => {
    setExporting(true);
    try {
      const data = await accountingCached(from, to);
      await exportAccountingByDay(data, from, to);
      showToast("✓ Excel yuklab olindi");
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "Eksport qilib bo'lmadi");
    } finally { setExporting(false); }
  };

  const load = useCallback(() => {
    api.analytics({ from, to }).then(setA).catch((e) => setErr(e instanceof Error ? e.message : "Xatolik"));
    api.analytics({ from: prevFrom, to: prevTo }).then(setPrev).catch(() => setPrev(null));
    accountingCached(from, to).then(setAcc).catch(() => setAcc(null));
    api.stockMovements({ movement_type: "waste", created_at_after: from, created_at_before: dateBeforeParam(to), page_size: 200 }).then(setWasteNow).catch(() => setWasteNow([]));
    api.stockMovements({ movement_type: "waste", created_at_after: prevFrom, created_at_before: dateBeforeParam(prevTo), page_size: 200 }).then(setWastePrev).catch(() => setWastePrev([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);

  if (err) return <p className="mt-10 text-center text-sm font-bold" style={{ color: "var(--danger-ink)" }}>{err}</p>;
  if (!a) return <FlowerLoader />;

  const s = a.summary;
  const ps = prev?.summary;
  // SAVDO = HAQIQIY katalog sotuvi (accounting bilan mos: catalog_sales_revenue). BUG-1 — server maydoni.
  const catRevenue = +(s.catalog_sales_revenue ?? 0);
  const catQty = s.catalog_sales_quantity ?? 0;
  const aovNow = catQty > 0 ? Math.round(catRevenue / catQty) : 0;
  const aovPrev = (ps?.catalog_sales_quantity ?? 0) > 0 ? Math.round(+(ps?.catalog_sales_revenue ?? 0) / (ps!.catalog_sales_quantity as number)) : 0;

  const tiles: { label: string; cur: number; prev: number; money?: boolean; suffix?: string; sub?: string }[] = [
    { label: "Savdo", cur: catRevenue, prev: +(ps?.catalog_sales_revenue ?? 0), money: true, sub: "haqiqiy katalog sotuvi" },
    { label: "Kutilayotgan buyurtmalar", cur: +(s.lead_revenue ?? 0), prev: +(ps?.lead_revenue ?? 0), money: true, sub: "lead-pipeline summasi" },
    { label: "So'rovlar", cur: s.leads, prev: ps?.leads ?? 0, sub: "lead" },
    { label: "Konversiya", cur: +s.conversion_rate, prev: +(ps?.conversion_rate ?? 0), suffix: "%", sub: "so'rovdan sotuvga" },
    { label: "O'rtacha chek", cur: aovNow, prev: aovPrev, money: true, sub: "1 katalog sotuviga" },
    { label: "Sotilgan gul", cur: s.flowers_sold_stems, prev: ps?.flowers_sold_stems ?? 0, sub: "dona" },
  ];

  // GUARD: ZZZ_TEST_ partiyalardagi chiqitni chiqarib tashlaymiz (lib/finance)
  const wN = excludeTest(wasteNow, (m) => m.batch_detail?.batch_number);
  const wP = excludeTest(wastePrev, (m) => m.batch_detail?.batch_number);
  const wasteByDate = new Map<string, number>();
  for (const m of wN) { const d = (m.created_at ?? "").slice(0, 10); wasteByDate.set(d, (wasteByDate.get(d) ?? 0) + Math.abs(m.quantity_stems)); }
  // KUNLIK: backend daily_stats endi catalog_revenue/orders/quantity + lead_revenue/orders beradi (gap-fill).
  // Klient bucketing OLIB TASHLANDI — server avtoritativ. BUG-3: biz date_to+1 yuborganimiz uchun to+1 kunini kesamiz.
  const daily = a.daily_stats.filter((d) => d.date <= to).map((d) => {
    const catRev = +(d.catalog_revenue ?? 0); const catOrd = d.catalog_orders ?? 0; const catQ = d.catalog_quantity ?? 0;
    return { ...d, catRev, leadRev: +(d.lead_revenue ?? 0), aov: catQ > 0 ? Math.round(catRev / catQ) : 0, conv: d.leads > 0 ? Math.round((catOrd / d.leads) * 100) : 0, waste: wasteByDate.get(d.date) ?? 0 };
  });

  // chiqit foizi = chiqit / (chiqit + sotilgan gul) — davr vs oldingi davr
  const wasteStemsNow = wN.reduce((t, m) => t + Math.abs(m.quantity_stems), 0);
  const wasteStemsPrev = wP.reduce((t, m) => t + Math.abs(m.quantity_stems), 0);
  const wasteValueNow = wN.reduce((t, m) => t + Math.abs(m.quantity_stems) * (+(m.batch_detail?.cost_per_stem ?? 0)), 0);
  const soldNow = s.flowers_sold_stems || 0;
  const soldPrev = ps?.flowers_sold_stems ?? 0;
  const wasteRate = (w: number, sold: number) => (w + sold > 0 ? (w / (w + sold)) * 100 : 0);
  const wasteRateNow = wasteRate(wasteStemsNow, soldNow);
  const wasteRatePrev = wasteRate(wasteStemsPrev, soldPrev);

  // hajm (kichik/o'rta/katta) bo'yicha taqsimot — accounting by_volume
  const volMap = new Map<string, { sales: number; qty: number }>();
  for (const r of acc?.by_volume ?? []) {
    if (!r.volume) continue;
    const e = volMap.get(r.volume) ?? { sales: 0, qty: 0 };
    volMap.set(r.volume, { sales: e.sales + +r.sales, qty: e.qty + r.quantity });
  }
  const volRows = Array.from(volMap.entries()).map(([vol, v]) => ({ label: VOLUME_LABEL[vol as keyof typeof VOLUME_LABEL] ?? vol, value: v.sales, sub: `${v.qty} ta` })).sort((x, y) => y.value - x.value);

  const totalConvSrc = Math.max(a.conversation_sources.reduce((t, r) => t + r.count, 0), 1);

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="relative flex flex-col gap-4">
      <motion.div variants={rise} className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold" style={{ color: "var(--text-2)" }}>Davr analitikasi — trendlar va taqqoslash</h2>
          <p className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>har bir raqam oldingi teng davr bilan solishtiriladi</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateChips />
          <button onClick={doExport} disabled={exporting} className="flex items-center gap-1.5 rounded-[13px] border-[1.5px] px-3.5 py-2 text-[13px] font-bold transition-colors duration-150 hover:bg-[var(--hover)] disabled:opacity-60" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }} title="Hisob-kitobni Excel'ga yuklab olish">
            <Download size={15} strokeWidth={2} /> {exporting ? "Yuklanmoqda…" : "Excel"}
          </button>
        </div>
      </motion.div>

      {/* xulosa plitkalari + delta */}
      <motion.div variants={rise} className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
        {tiles.map((t) => (
          <div key={t.label} className="glass-lite p-4">
            <div className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{t.label}</div>
            <div className="mt-1.5 whitespace-nowrap text-[22px] font-semibold tracking-tight">
              <CountUp value={t.cur} format={t.money ? fmtMoney : undefined} />{t.suffix}
            </div>
            <div className="mt-1 flex items-center justify-between gap-2">
              {t.sub && <span className="text-[12px] font-medium" style={{ color: "var(--text-2)" }}>{t.sub}</span>}
              <Delta cur={t.cur} prev={t.prev} />
            </div>
          </div>
        ))}
      </motion.div>

      {/* TRENDLAR */}
      <div className="grid items-start gap-4 xl:grid-cols-2">
        <Card title="Kunlik savdo" sub="katalog savdo (daily_stats.catalog_revenue) + kutilayotgan (lead_revenue), so'mda">
          <DailyChart data={daily} series={[
            { key: "catRev", label: "Katalog savdo", varName: "var(--chart-1)" },
            { key: "leadRev", label: "Kutilayotgan (lead)", varName: "var(--chart-2)" },
          ]} />
        </Card>
        <Card title="Kunlik faollik" sub="daily_stats: so'rovlar, suhbatlar, sotuvlar (lead+katalog)">
          <DailyChart data={daily} series={[
            { key: "leads", label: "So'rovlar", varName: "var(--chart-1)" },
            { key: "conversations", label: "Suhbatlar", varName: "var(--chart-2)" },
            { key: "orders", label: "Sotuvlar", varName: "var(--chart-3)" },
          ]} />
        </Card>
        <Card title="Konversiya trendi" sub="kunlik: catalog_orders / so'rovlar (%)">
          <DailyChart data={daily} series={[{ key: "conv", label: "Konversiya %", varName: "var(--chart-1)" }]} />
        </Card>
        <Card title="O'rtacha chek trendi" sub="kunlik: catalog_revenue / catalog_quantity (so'm)">
          <DailyChart data={daily} series={[{ key: "aov", label: "O'rtacha chek", varName: "var(--chart-2)" }]} />
        </Card>
      </div>

      {/* CHIQIT TRENDI */}
      <motion.section variants={rise} className="glass-lite p-5">
        <div className="mb-3.5 flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="text-[15px] font-bold tracking-tight">Chiqit foizi</h2><p className="mt-0.5 text-[12px] font-medium" style={{ color: "var(--muted)" }}>chiqit / (chiqit + sotilgan gul) · kamayishi yaxshi</p></div>
          <div className="text-right">
            <div className="text-[22px] font-semibold tracking-tight" style={{ color: wasteRateNow > 8 ? "var(--danger-ink)" : "var(--text)" }}>{wasteRateNow.toFixed(1)}%</div>
            <Delta cur={wasteRateNow} prev={wasteRatePrev} goodUp={false} />
          </div>
        </div>
        <div className="mb-3 flex flex-wrap gap-4 text-[13px]">
          <span style={{ color: "var(--text-2)" }}>Chiqit: <b>{wasteStemsNow.toLocaleString("ru")}</b> dona</span>
          <span style={{ color: "var(--text-2)" }}>Yo&apos;qotish: <b style={{ color: "var(--danger-ink)" }}>{fmt(wasteValueNow)}</b></span>
          <span style={{ color: "var(--muted)" }}>Oldingi davr: {wasteStemsPrev.toLocaleString("ru")} dona</span>
        </div>
        <DailyChart data={daily} series={[{ key: "waste", label: "Chiqit (dona)", varName: "var(--chart-3)" }]} />
      </motion.section>

      {/* MAHSULOT ANALITIKASI */}
      <div className="grid items-start gap-4 lg:grid-cols-2 xl:grid-cols-3">
        <Card title="Eng ko'p sotilgan gullar" sub="dona bo'yicha, tanlangan davr">
          <HBars rows={a.top_selling_flowers.map((f) => ({ label: `${f.name_uz}${f.color_uz ? ` — ${f.color_uz}` : ""}`, value: f.stems, sub: `${f.bunches} pochka` }))} unit="dona" />
        </Card>
        <Card title="Top katalog mahsulotlari" sub="katalog sotuvi bo'yicha — bosib mahsulotni oching">
          {a.top_catalog_items.length === 0 ? <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>Bu davrda katalog sotuvi yo&apos;q.</p> : (
            <div className="flex flex-col gap-1.5">
              {a.top_catalog_items.map((c) => (
                <Link key={c.catalog_item_id} href={`/katalog?item=${c.catalog_item_id}`} className="card-hover flex items-center gap-2.5 rounded-[12px] border p-2" style={{ borderColor: "var(--line2)" }}>
                  <div className="h-9 w-9 shrink-0 overflow-hidden rounded-[9px] border" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    {c.catalog_item__image_url && <img src={c.catalog_item__image_url} alt="" className="h-full w-full object-cover" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[13.5px] font-bold" title={c.catalog_item__name_uz || c.catalog_item__name_ru}>{c.catalog_item__name_uz || c.catalog_item__name_ru}</span>
                      {c.catalog_kind && <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: c.catalog_kind === "custom" ? "color-mix(in srgb, var(--warning-ink) 15%, transparent)" : "var(--surface-2)", color: c.catalog_kind === "custom" ? "var(--warning-ink)" : "var(--text-2)" }}>{KIND_LABEL[c.catalog_kind]}</span>}
                    </div>
                    <div className="truncate text-[11.5px]" style={{ color: "var(--muted)" }}>{ARRANGEMENT_LABEL[c.catalog_item__arrangement_type] ?? c.catalog_item__arrangement_type} · {c.quantity} dona · {c.orders ?? 0} sotuv{c.last_sold_at ? ` · oxirgi: ${fmtDate(c.last_sold_at)}` : ""}</div>
                  </div>
                  <span className="shrink-0 text-right text-[13px] font-bold tabular-nums" style={{ color: "var(--acc)" }}>{fmt(c.revenue)}</span>
                </Link>
              ))}
            </div>
          )}
        </Card>
        <Card title="Buyurtma turlari" sub="buket / savat / donalab / katalog">
          <HBars rows={a.arrangement_types.slice().sort((x, y) => y.count - x.count).map((r) => ({ label: ARRANGEMENT_LABEL[r.arrangement_type] ?? r.arrangement_type ?? "Boshqa", value: r.count }))} unit="ta" color="var(--chart-3)" />
        </Card>
        <Card title="Hajm bo'yicha sotuvlar" sub="kichik / o'rta / katta — savdo summasi">
          {volRows.length ? <HBars rows={volRows} format={(v) => `${fmtMoney(v)} so'm`} color="var(--chart-1)" /> : <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>Bu davrda sotuv yo&apos;q.</p>}
        </Card>

        {/* KANAL ANALITIKASI */}
        <Card title="Suhbat manbalari" sub="qaysi kanaldan kelmoqda">
          <div className="flex flex-col gap-3">
            {a.conversation_sources.slice().sort((x, y) => y.count - x.count).map((r) => {
              const meta = SOURCE_META[r.source] ?? { label: r.source, bg: "var(--muted)", icon: SmartPhone01Icon };
              const share = Math.round((r.count / totalConvSrc) * 100);
              return (
                <div key={r.source}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[13px] font-semibold">
                      <span className="flex h-[22px] w-[22px] items-center justify-center rounded-full text-white" style={{ background: meta.bg }}><HugeiconsIcon icon={meta.icon} size={12} strokeWidth={2} /></span>
                      {meta.label}
                    </span>
                    <span className="text-[13px] font-bold tabular-nums">{r.count} <span className="font-medium" style={{ color: "var(--muted)" }}>· {share}%</span></span>
                  </div>
                  <div className="h-[8px] overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${share}%`, background: meta.bg }} /></div>
                </div>
              );
            })}
            {a.conversation_sources.length === 0 && <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>Ma&apos;lumot yo&apos;q.</p>}
          </div>
        </Card>
        <Card title="Manbalar bo'yicha daromad" sub="qaysi kanal qancha keltirdi">
          <HBars rows={a.revenue_by_source.slice().sort((x, y) => +y.revenue - +x.revenue).map((r) => ({ label: r.source_label ?? SOURCE_META[r.source]?.label ?? r.source, value: +r.revenue, sub: `${r.orders} ta sotuv`, ...(/catalog/i.test(r.source) ? { color: "var(--primary)" } : {}) }))} format={(v) => `${fmtMoney(v)} so'm`} color="var(--chart-2)" />
        </Card>
      </div>
    </motion.div>
  );
}
