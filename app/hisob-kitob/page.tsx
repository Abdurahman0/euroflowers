"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Download, Trash2, Package, Flower2, Coins, Users2, TrendingDown } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { accountingCached, stockBatchesCached } from "@/lib/reportCache";
import { usePerm, useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { fmt, fmtDate, dateAfterParam, dateBeforeParam } from "@/lib/format";
import { KIND_LABEL, VOLUME_LABEL, SALARY_SOURCE_LABEL, formatStemsAndBunches } from "@/lib/inventory";
import { ARRANGEMENT_LABEL } from "@/components/badges";
import { num, saleProfit, profitTone, unitCostSplit, wasteValue, costBreakdown, saleLineAllocations, excludeTest } from "@/lib/finance";
import * as X from "@/lib/reportExports";
import DateChips from "@/components/DateChips";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import type { Accounting, Analytics, CatalogItem, FloristProfile, FloristSalaryEntry, StockBatch, StockMovement, Supplier } from "@/lib/types";

/**
 * HISOB-KITOB — pulning YAGONA sahifasi (owner shu yerda "yashaydi").
 * 5 bo'lim, har biri saralanadigan/kengaytiriladigan ro'yxat + Excel eksport:
 *  1) Yetkazib beruvchilar  2) Katalog foydasi  3) Gul turlari  4) Xarajatlar taqsimoti  5) Floristlar.
 * Backend avtoritativ raqamlar ustuvor (net_profit/cost_total); klient hisoblari
 * lib/finance.ts'da (testlangan) va nomuvofiqlikda reconcile() ogohlantiradi.
 */

const DEV = process.env.NODE_ENV !== "production";
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const floristName = (f?: FloristProfile) => f ? [f.user_detail?.first_name, f.user_detail?.last_name].filter(Boolean).join(" ") || f.user_detail?.username || `#${f.id}` : "—";

/** Izohli ⓘ — hosila raqam QANDAY hisoblangani (owner metodni ko'ra oladi). */
const Tip = ({ text }: { text: string }) => <span title={text} className="ml-1 cursor-help align-middle text-[10px] font-bold" style={{ color: "var(--muted)" }}>ⓘ</span>;
/** Dev-only nomuvofiqlik nuqtasi — server/klient farq qilsa ko'zga tashlanadi. */
const Mismatch = ({ on, label }: { on: boolean; label: string }) => (DEV && on ? <span title={`Server/klient nomuvofiqligi: ${label} (server qiymati ko'rsatilmoqda)`} className="ml-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: "var(--danger-ink)" }} /> : null);

function SectionCard({ n, icon, title, sub, onExport, children }: { n: number; icon: React.ReactNode; title: string; sub: string; onExport?: () => void; children: React.ReactNode }) {
  return (
    <section className="glass !rounded-[18px] p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-[12px]" style={{ background: "var(--surface-2)", color: "var(--primary)" }}>{icon}</span>
          <div>
            <h2 className="text-[16px] font-bold tracking-tight">{n}. {title}</h2>
            <p className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>{sub}</p>
          </div>
        </div>
        {onExport && (
          <button onClick={onExport} className="flex items-center gap-1.5 rounded-[11px] border-[1.5px] px-3 py-1.5 text-[12.5px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }} title="Shu bo'limni Excel'ga yuklab olish">
            <Download size={14} strokeWidth={2} /> Excel
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

const Money = ({ v, tone, bold }: { v: number; tone?: string; bold?: boolean }) => (
  <span className={`tabular-nums ${bold ? "font-bold" : "font-semibold"}`} style={{ color: tone }}>{fmt(v)}</span>
);

type SortKey = "net" | "margin" | "date";

export default function HisobKitobPage() {
  const { dateFilter, dateRange, showToast } = useStore();
  const { canView } = usePerm();
  const visible = canView("dashboard");

  const [acc, setAcc] = useState<Accounting | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [waste, setWaste] = useState<StockMovement[]>([]);
  const [prod, setProd] = useState<Analytics["florist_production_stats"]>([]);
  const [salary, setSalary] = useState<FloristSalaryEntry[]>([]);
  const [payAvailable, setPayAvailable] = useState(false);
  const [err, setErr] = useState("");

  const [catSort, setCatSort] = useState<SortKey>("net");
  const [catGrouped, setCatGrouped] = useState(false);
  const [openCat, setOpenCat] = useState<number | null>(null);
  const [openSup, setOpenSup] = useState<number | null>(null);
  const [openFlo, setOpenFlo] = useState<number | null>(null);
  const [wasteOpen, setWasteOpen] = useState(false);
  const [includeTest, setIncludeTest] = useState(false); // dev-toggle: ZZZ_TEST_ yozuvlarni qo'shish

  const from = dateRange ? dateRange.from : dateAfterParam(dateFilter);
  const to = dateRange ? dateRange.to : ymd(new Date());

  const load = useCallback(() => {
    if (!visible) return;
    accountingCached(from, to).then((d) => { setAcc(d); setErr(""); }).catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi"));
    api.catalog().then(setCatalog).catch(() => setCatalog([]));
    stockBatchesCached().then(setBatches).catch(() => setBatches([]));
    api.suppliers().then(setSuppliers).catch(() => setSuppliers([]));
    api.stockMovements({ movement_type: "waste", created_at_after: from, created_at_before: dateBeforeParam(to), page_size: 200 }).then(setWaste).catch(() => setWaste([]));
    api.analytics({ from, to }).then((a) => setProd(a.florist_production_stats ?? [])).catch(() => setProd([]));
    api.floristSalary().then(setSalary).catch(() => setSalary([]));
    api.supplierPayments().then(() => setPayAvailable(true)).catch(() => setPayAvailable(false));
  }, [visible, from, to]);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);
  useEffect(() => {
    const h = () => load();
    window.addEventListener("ef:stock-changed", h);
    return () => window.removeEventListener("ef:stock-changed", h);
  }, [load]);

  const catalogById = useMemo(() => new Map(catalog.map((i) => [i.id, i])), [catalog]);
  // GUARD: ZZZ_TEST_ yozuvlar hisobotdan chiqariladi (dev-toggle bilan qaytariladi).
  // Backend test partiyalari/harakatlarini o'chira olmaydi (soft-delete/405) — shu filtr himoya.
  const sales = useMemo(() => excludeTest(acc?.history ?? [], (s) => s.catalog_name, includeTest), [acc, includeTest]);
  const cleanBatches = useMemo(() => excludeTest(batches, (b) => b.batch_number, includeTest), [batches, includeTest]);
  const cleanWaste = useMemo(() => excludeTest(waste, (m) => m.batch_detail?.batch_number, includeTest), [waste, includeTest]);

  // ── Section 2: katalog foydasi (har sotuv) ───────────────────────
  const catRows = useMemo(() => sales.map((s) => {
    const p = saleProfit(s);
    return { s, p, item: catalogById.get(s.catalog_id) };
  }).sort((a, b) => catSort === "net" ? b.p.net - a.p.net : catSort === "margin" ? b.p.margin - a.p.margin : +new Date(b.s.sold_at) - +new Date(a.s.sold_at)), [sales, catalogById, catSort]);

  const catGroups = useMemo(() => {
    const m = new Map<string, { name: string; qty: number; sale: number; net: number }>();
    for (const { s, p } of catRows) {
      const e = m.get(s.catalog_name) ?? { name: s.catalog_name, qty: 0, sale: 0, net: 0 };
      e.qty += s.quantity; e.sale += p.sale; e.net += p.net; m.set(s.catalog_name, e);
    }
    return Array.from(m.values()).map((g) => ({ ...g, perUnit: g.qty ? g.net / g.qty : 0, margin: g.sale ? (g.net / g.sale) * 100 : 0 })).sort((a, b) => b.net - a.net);
  }, [catRows]);

  // ── Section 1: yetkazib beruvchilar ──────────────────────────────
  const supplierData = useMemo(() => {
    const allocs = sales.flatMap((s) => saleLineAllocations(s, catalogById.get(s.catalog_id)));
    const byBatchSupplier = new Map<number, number>(); // batchId → supplierId
    for (const b of cleanBatches) if (b.supplier != null) byBatchSupplier.set(b.id, b.supplier);
    type Agg = { revenue: number; cost: number; receivedStems: number; purchase: number; wasteStems: number; wasteValue: number; batches: StockBatch[] };
    const agg = new Map<number, Agg>();
    const ensure = (id: number): Agg => { let a = agg.get(id); if (!a) { a = { revenue: 0, cost: 0, receivedStems: 0, purchase: 0, wasteStems: 0, wasteValue: 0, batches: [] }; agg.set(id, a); } return a; };
    for (const b of cleanBatches) if (b.supplier != null) { const a = ensure(b.supplier); a.receivedStems += b.received_stems; a.purchase += b.received_stems * num(b.cost_per_stem); a.batches.push(b); }
    for (const l of allocs) if (l.supplierId != null) { const a = ensure(l.supplierId); a.revenue += l.revenue; a.cost += l.cost; }
    for (const m of cleanWaste) { const sid = m.batch_detail?.supplier ?? null; if (sid != null) { const a = ensure(sid); const q = Math.abs(m.quantity_stems); a.wasteStems += q; a.wasteValue += q * num(m.batch_detail?.cost_per_stem); } }
    const supById = new Map(suppliers.map((s) => [s.id, s]));
    const rows = Array.from(agg.entries()).map(([id, a]) => {
      const profit = a.revenue - a.cost;
      return { id, name: supById.get(id)?.name ?? `#${id}`, ...a, profit, margin: a.revenue ? (profit / a.revenue) * 100 : 0, wastePct: a.receivedStems ? (a.wasteStems / a.receivedStems) * 100 : 0 };
    }).sort((x, y) => y.purchase - x.purchase);
    const anySupplier = cleanBatches.some((b) => b.supplier != null);
    return { rows, anySupplier };
  }, [sales, catalogById, cleanBatches, cleanWaste, suppliers]);

  // ── Section 3: gul turlari (variant) ─────────────────────────────
  const variantRows = useMemo(() => {
    type Agg = { name: string; purchasedStems: number; purchaseSum: number; soldStems: number; revenue: number; cost: number; wasteStems: number; wasteValue: number };
    const agg = new Map<number, Agg>();
    const label = (b?: StockBatch) => b ? `${b.variant_detail?.flower_detail?.name_uz ?? ""} ${b.variant_detail?.name_uz ?? ""}${b.variant_detail?.color_uz ? ` (${b.variant_detail.color_uz})` : ""}`.trim() : "—";
    const ensure = (id: number, nm: string): Agg => { let a = agg.get(id); if (!a) { a = { name: nm, purchasedStems: 0, purchaseSum: 0, soldStems: 0, revenue: 0, cost: 0, wasteStems: 0, wasteValue: 0 }; agg.set(id, a); } return a; };
    for (const b of cleanBatches) { const a = ensure(b.variant, label(b)); a.purchasedStems += b.received_stems; a.purchaseSum += b.received_stems * num(b.cost_per_stem); }
    for (const s of sales) for (const l of saleLineAllocations(s, catalogById.get(s.catalog_id))) if (l.variantId != null) { const a = ensure(l.variantId, agg.get(l.variantId)?.name ?? "—"); a.soldStems += l.stems; a.revenue += l.revenue; a.cost += l.cost; }
    for (const m of cleanWaste) { const vid = m.batch_detail?.variant; if (vid != null) { const a = ensure(vid, label(m.batch_detail)); const q = Math.abs(m.quantity_stems); a.wasteStems += q; a.wasteValue += q * num(m.batch_detail?.cost_per_stem); } }
    return Array.from(agg.values()).map((a) => ({ ...a, profit: a.revenue - a.cost, margin: a.revenue ? ((a.revenue - a.cost) / a.revenue) * 100 : 0 })).sort((x, y) => y.profit - x.profit);
  }, [cleanBatches, sales, catalogById, cleanWaste]);

  // ── Section 4: xarajatlar taqsimoti ──────────────────────────────
  const breakdown = useMemo(() => costBreakdown(sales, catalogById, cleanWaste, num(acc?.summary.discount_total)), [sales, catalogById, cleanWaste, acc]);

  // ── Section 5: floristlar ────────────────────────────────────────
  const floristRows = useMemo(() => {
    const profitByFlo = new Map<number, { value: number; profit: number }>();
    for (const s of sales) if (s.florist_id != null) { const e = profitByFlo.get(s.florist_id) ?? { value: 0, profit: 0 }; e.value += num(s.sale_total); e.profit += num(s.net_profit); profitByFlo.set(s.florist_id, e); }
    return (prod ?? []).map((p) => {
      const id = p.florist_id ?? 0;
      const standard = (p.standard_bouquets ?? 0) + (p.standard_baskets ?? 0);
      const custom = (p.custom_bouquets ?? 0) + (p.custom_baskets ?? 0);
      const total = p.catalog_total ?? 0;
      const pf = profitByFlo.get(id) ?? { value: 0, profit: 0 };
      const salaryTotal = num(p.salary_total);
      return { id, name: p.name ?? "—", staffType: p.staff_type ?? "florist", standard, custom, total, salary: salaryTotal, avgPerItem: total ? salaryTotal / total : 0, productionValue: pf.value, totalProfit: pf.profit };
    }).sort((a, b) => b.totalProfit - a.totalProfit);
  }, [prod, sales]);
  const salaryByFlo = useMemo(() => { const m = new Map<number, FloristSalaryEntry[]>(); for (const e of salary) { const arr = m.get(e.florist) ?? []; arr.push(e); m.set(e.florist, arr); } return m; }, [salary]);

  // ── Excel eksport qatorlari ──────────────────────────────────────
  const supplierExport = (): X.SupplierRow[] => supplierData.rows.map((r) => ({ name: r.name, receivedStems: r.receivedStems, purchase: r.purchase, paid: payAvailable ? 0 : null, debt: payAvailable ? r.purchase : null, revenue: r.revenue, profit: r.profit, margin: Math.round(r.margin), wasteStems: r.wasteStems, wasteValue: r.wasteValue }));
  const catalogExport = (): X.CatalogProfitRow[] => catRows.map(({ s, p }) => ({ name: s.catalog_name, kind: KIND_LABEL[s.catalog_kind] ?? s.catalog_kind, arrangement: ARRANGEMENT_LABEL[s.arrangement_type as keyof typeof ARRANGEMENT_LABEL] ?? s.arrangement_type, volume: s.volume ? VOLUME_LABEL[s.volume] : "—", florist: s.florist_name, soldAt: fmtDate(s.sold_at), qty: s.quantity, sale: p.sale, cost: p.cost, discount: p.discount, net: p.net, margin: Math.round(p.margin) }));
  const variantExport = (): X.VariantRow[] => variantRows.map((r) => ({ name: r.name, purchasedStems: r.purchasedStems, purchaseSum: r.purchaseSum, soldStems: r.soldStems, wasteStems: r.wasteStems, wasteValue: r.wasteValue, revenue: r.revenue, profit: r.profit, margin: Math.round(r.margin) }));
  const floristExport = (): X.FloristRow[] => floristRows.map((r) => ({ name: r.name, staffType: r.staffType, standard: r.standard, custom: r.custom, productionValue: r.productionValue, salary: r.salary, avgPerItem: Math.round(r.avgPerItem), totalProfit: r.totalProfit }));
  const breakdownExport = (): X.CostBreakdownRow[] => {
    const base = breakdown.salesTotal || 1;
    return [
      { label: "Gullar tannarxi", amount: breakdown.flower, pct: Math.round((breakdown.flower / base) * 100) },
      { label: "Materiallar tannarxi", amount: breakdown.material, pct: Math.round((breakdown.material / base) * 100) },
      { label: "Florist haqi", amount: breakdown.fee, pct: Math.round((breakdown.fee / base) * 100) },
      { label: "Chiqit yo'qotishi", amount: breakdown.waste, pct: Math.round((breakdown.waste / base) * 100) },
      { label: "Chegirmalar", amount: breakdown.discounts, pct: Math.round((breakdown.discounts / base) * 100) },
      { label: "Sof foyda", amount: breakdown.netProfit, pct: Math.round((breakdown.netProfit / base) * 100) },
    ];
  };
  const doExportAll = () => X.exportAll([X.supplierSheet(supplierExport()), X.catalogSheet(catalogExport()), X.variantSheet(variantExport()), X.breakdownSheet(breakdownExport()), X.floristSheet(floristExport())], from, to).then(() => showToast("✓ Barchasi yuklab olindi")).catch(() => showToast("Eksport qilib bo'lmadi"));
  const doExport = (label: string, sheet: () => import("@/lib/xlsx").SheetDef) => X.exportSection(label, sheet(), from, to).then(() => showToast("✓ Excel yuklab olindi")).catch(() => showToast("Eksport qilib bo'lmadi"));

  if (!visible) return <div className="mt-10"><EmptyState title="Ruxsat yo'q" sub="Hisob-kitobni ko'rish uchun ruxsatingiz yo'q." /></div>;
  if (err) return <p className="mt-10 text-center text-sm font-bold" style={{ color: "var(--danger-ink)" }}>{err}</p>;
  if (!acc) return <FlowerLoader />;

  const s = acc.summary;

  return (
    <div className="relative flex flex-col gap-5">
      {/* sarlavha + davr + Barchasi eksport */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold" style={{ color: "var(--text-2)" }}>Hisob-kitob — pul qayerda</h2>
          <p className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>server avtoritativ · klient hisoblari tekshirilgan (lib/finance)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {DEV && (
            <label className="flex cursor-pointer items-center gap-1.5 rounded-[11px] border px-2.5 py-1.5 text-[12px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--muted)" }} title="Dev: ZZZ_TEST_ yozuvlarni hisobotga qo'shish (odatda chiqarilgan)">
              <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--primary)]" />
              Test yozuvlar
            </label>
          )}
          <DateChips />
          <button onClick={doExportAll} className="flex items-center gap-1.5 rounded-[13px] px-3.5 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90" style={{ background: "var(--primary)" }} title="Barcha bo'limlar — bitta Excel kitobi">
            <Download size={15} strokeWidth={2} /> Barchasi
          </button>
        </div>
      </div>

      {/* KPI qatori */}
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))" }}>
        {[
          { label: "Umumiy savdo", v: fmt(s.total_sales), sub: `${s.total_quantity} ta sotuv` },
          { label: "Sof foyda", v: fmt(s.net_profit), sub: `tannarx ${fmt(s.cost_total)}`, hue: profitTone(num(s.net_profit), num(s.total_sales) ? (num(s.net_profit) / num(s.total_sales)) * 100 : 0) },
          { label: "Chegirmalar", v: fmt(s.discount_total), sub: `${s.discounted_sales_count} ta sotuvda` },
          { label: "Chiqit yo'qotishi", v: fmt(wasteValue(cleanWaste).value), sub: `${wasteValue(cleanWaste).stems} dona`, hue: "var(--danger-ink)" },
        ].map((k) => (
          <div key={k.label} className="glass !rounded-[16px] p-4">
            <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{k.label}</div>
            <div className="mt-1.5 whitespace-nowrap text-[20px] font-extrabold tracking-tight" style={{ color: k.hue ?? "var(--text)" }}>{k.v}</div>
            <div className="mt-0.5 text-[12px] font-medium" style={{ color: "var(--text-2)" }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* ═══ SECTION 1 — YETKAZIB BERUVCHILAR ═══ */}
      <SectionCard n={1} icon={<Package size={18} strokeWidth={2} />} title="Yetkazib beruvchilar" sub="xarid, tushum, foyda va chiqit — har biri partiyalariga ochiladi" onExport={supplierData.rows.length ? () => doExport("Yetkazib_beruvchilar", () => X.supplierSheet(supplierExport())) : undefined}>
        {!supplierData.anySupplier ? (
          <div className="rounded-[14px] border border-dashed p-6 text-center" style={{ borderColor: "var(--border)" }}>
            <p className="text-[14px] font-bold">Partiyalarga yetkazib beruvchi biriktirilmagan</p>
            <p className="mx-auto mt-1 max-w-md text-[13px]" style={{ color: "var(--muted)" }}>Xarid va tushumni yetkazib beruvchi bo&apos;yicha ko&apos;rish uchun sklad partiyalarига yetkazib beruvchini biriktiring.</p>
            <Link href="/sklad?tab=partiyalar" className="mt-3 inline-block rounded-[11px] px-4 py-2 text-[13px] font-bold text-white" style={{ background: "var(--primary)" }}>Skladga o&apos;tish →</Link>
          </div>
        ) : (
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[860px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left" style={{ color: "var(--muted)" }}>
                  <th className="px-2 py-2 font-semibold">Yetkazib beruvchi</th>
                  <th className="px-2 py-2 text-right font-semibold">Olingan</th>
                  <th className="px-2 py-2 text-right font-semibold">Xarid summasi</th>
                  <th className="px-2 py-2 text-right font-semibold">To&apos;langan</th>
                  <th className="px-2 py-2 text-right font-semibold">Qarz</th>
                  <th className="px-2 py-2 text-right font-semibold">Tushum<Tip text="Sotuv summasi har bir gul qatoriga tannarx ulushi bo'yicha taqsimlanadi." /></th>
                  <th className="px-2 py-2 text-right font-semibold">Foyda / Marja</th>
                  <th className="px-2 py-2 text-right font-semibold">Chiqit</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {supplierData.rows.map((r) => (
                  <FragmentRows key={r.id} open={openSup === r.id}
                    row={
                      <tr onClick={() => setOpenSup(openSup === r.id ? null : r.id)} className="cursor-pointer border-t transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--line2)" }}>
                        <td className="px-2 py-2.5 font-bold">{r.name}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{r.receivedStems.toLocaleString("ru")} dona</td>
                        <td className="px-2 py-2.5 text-right"><Money v={r.purchase} /></td>
                        <td className="px-2 py-2.5 text-right" style={{ color: "var(--muted)" }}>{payAvailable ? fmt(0) : "—"}</td>
                        <td className="px-2 py-2.5 text-right" style={{ color: "var(--muted)" }}>{payAvailable ? <Money v={r.purchase} /> : <span className="text-[11px] font-semibold italic">Qarz hisobi tez orada</span>}</td>
                        <td className="px-2 py-2.5 text-right"><Money v={r.revenue} /></td>
                        <td className="px-2 py-2.5 text-right"><Money v={r.profit} tone={profitTone(r.profit, r.margin)} bold /> <span className="text-[11px]" style={{ color: "var(--muted)" }}>{Math.round(r.margin)}%</span></td>
                        <td className="px-2 py-2.5 text-right" style={{ color: "var(--danger-ink)" }}>{r.wasteStems ? `${fmt(r.wasteValue)} · ${Math.round(r.wastePct)}%` : "—"}</td>
                        <td className="px-2 text-right"><ChevronRight size={15} className={`transition-transform ${openSup === r.id ? "rotate-90" : ""}`} style={{ color: "var(--muted)" }} /></td>
                      </tr>
                    }
                    detail={
                      <div className="px-2 py-2">
                        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Partiyalar</div>
                        <div className="flex flex-col gap-1">
                          {r.batches.map((b) => (
                            <div key={b.id} className="flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5" style={{ background: "var(--surface-2)" }}>
                              <span className="min-w-0 truncate">№{b.batch_number} · {b.variant_detail?.flower_detail?.name_uz} {b.variant_detail?.name_uz}</span>
                              <span className="shrink-0 tabular-nums" style={{ color: "var(--text-2)" }}>{formatStemsAndBunches(b.remaining_stems, b.stems_per_bunch)} qoldiq · tannarx {fmt(b.cost_per_stem)}/dona</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    }
                    cols={9}
                  />
                ))}
              </tbody>
            </table>
            {payAvailable ? null : <p className="mt-2 text-[11.5px]" style={{ color: "var(--muted)" }}>To&apos;langan / Qarz — backend <code>/supplier-payments/</code> qo&apos;shilgach avtomatik yonadi. Hozircha xarid summasi ko&apos;rsatilmoqda.</p>}
          </div>
        )}
      </SectionCard>

      {/* ═══ SECTION 2 — KATALOG FOYDASI (eng ko'p ishlatiladigan) ═══ */}
      <SectionCard n={2} icon={<Coins size={18} strokeWidth={2} />} title="Katalog bo'yicha foyda" sub="har bir sotuv: sotuv − gullar − materiallar − florist haqi − chegirma" onExport={catRows.length ? () => doExport("Katalog_foydasi", () => X.catalogSheet(catalogExport())) : undefined}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-[11px] p-1" style={{ background: "var(--surface-2)" }}>
            {([["net", "Foyda"], ["margin", "Marja"], ["date", "Sana"]] as [SortKey, string][]).map(([k, lbl]) => (
              <button key={k} onClick={() => setCatSort(k)} className="rounded-[8px] px-2.5 py-1 text-[12px] font-bold transition-colors" style={{ background: catSort === k ? "var(--surface-solid)" : "transparent", color: catSort === k ? "var(--primary)" : "var(--muted)" }}>{lbl}</button>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-[11px] p-1" style={{ background: "var(--surface-2)" }}>
            <button onClick={() => setCatGrouped(false)} className="rounded-[8px] px-2.5 py-1 text-[12px] font-bold" style={{ background: !catGrouped ? "var(--surface-solid)" : "transparent", color: !catGrouped ? "var(--primary)" : "var(--muted)" }}>Sotuvlar</button>
            <button onClick={() => setCatGrouped(true)} className="rounded-[8px] px-2.5 py-1 text-[12px] font-bold" style={{ background: catGrouped ? "var(--surface-solid)" : "transparent", color: catGrouped ? "var(--primary)" : "var(--muted)" }}>Mahsulot bo&apos;yicha</button>
          </div>
        </div>

        {catRows.length === 0 ? <EmptyState title="Bu davrda sotuv yo'q" sub="Boshqa davrni tanlang." /> : catGrouped ? (
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[560px] border-collapse text-[13px]">
              <thead><tr className="text-left" style={{ color: "var(--muted)" }}><th className="px-2 py-2 font-semibold">Mahsulot</th><th className="px-2 py-2 text-right font-semibold">Soni</th><th className="px-2 py-2 text-right font-semibold">Savdo</th><th className="px-2 py-2 text-right font-semibold">Sof foyda</th><th className="px-2 py-2 text-right font-semibold">Bittasiga<Tip text="Sof foyda / sotilgan soni" /></th></tr></thead>
              <tbody>
                {catGroups.map((g) => (
                  <tr key={g.name} className="border-t" style={{ borderColor: "var(--line2)" }}>
                    <td className="px-2 py-2.5 font-bold">{g.name}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{g.qty}</td>
                    <td className="px-2 py-2.5 text-right"><Money v={g.sale} /></td>
                    <td className="px-2 py-2.5 text-right"><Money v={g.net} tone={profitTone(g.net, g.margin)} bold /> <span className="text-[11px]" style={{ color: "var(--muted)" }}>{Math.round(g.margin)}%</span></td>
                    <td className="px-2 py-2.5 text-right"><Money v={g.perUnit} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[820px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left" style={{ color: "var(--muted)" }}>
                  <th className="px-2 py-2 font-semibold">Nomi</th>
                  <th className="px-2 py-2 font-semibold">Florist</th>
                  <th className="px-2 py-2 text-right font-semibold">Sotilgan</th>
                  <th className="px-2 py-2 text-right font-semibold">Sotuv</th>
                  <th className="px-2 py-2 text-right font-semibold">Tannarx</th>
                  <th className="px-2 py-2 text-right font-semibold">Chegirma</th>
                  <th className="px-2 py-2 text-right font-semibold">Sof foyda / Marja</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {catRows.map(({ s: sale, p, item }) => (
                  <FragmentRows key={sale.history_id} open={openCat === sale.history_id}
                    row={
                      <tr onClick={() => setOpenCat(openCat === sale.history_id ? null : sale.history_id)} className="cursor-pointer border-t transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--line2)" }}>
                        <td className="px-2 py-2.5"><div className="font-bold">{sale.catalog_name}</div><div className="text-[11px]" style={{ color: "var(--muted)" }}>{ARRANGEMENT_LABEL[sale.arrangement_type as keyof typeof ARRANGEMENT_LABEL] ?? sale.arrangement_type}{sale.volume ? ` · ${VOLUME_LABEL[sale.volume]}` : ""} · {KIND_LABEL[sale.catalog_kind]}</div></td>
                        <td className="px-2 py-2.5">{sale.florist_name || "—"}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{fmtDate(sale.sold_at)}<div className="text-[11px]" style={{ color: "var(--muted)" }}>{sale.quantity} ta</div></td>
                        <td className="px-2 py-2.5 text-right"><Money v={p.sale} /></td>
                        <td className="px-2 py-2.5 text-right" style={{ color: "var(--text-2)" }}><Money v={p.cost} /></td>
                        <td className="px-2 py-2.5 text-right" style={{ color: p.discount ? "var(--warning-ink)" : "var(--muted)" }}>{p.discount ? fmt(p.discount) : "—"}</td>
                        <td className="px-2 py-2.5 text-right"><Money v={p.net} tone={profitTone(p.net, p.margin)} bold /><Mismatch on={p.diverged} label="net_profit" /> <span className="text-[11px]" style={{ color: "var(--muted)" }}>{Math.round(p.margin)}%</span></td>
                        <td className="px-2 text-right"><ChevronRight size={15} className={`transition-transform ${openCat === sale.history_id ? "rotate-90" : ""}`} style={{ color: "var(--muted)" }} /></td>
                      </tr>
                    }
                    detail={<CatalogDetail sale={sale} item={item} net={p.net} cost={p.cost} />}
                    cols={8}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ═══ SECTION 3 — GUL TURLARI ═══ */}
      <SectionCard n={3} icon={<Flower2 size={18} strokeWidth={2} />} title="Gul turlari bo'yicha" sub="qaysi nav pul keltiryapti, qaysisi zarar — xarid, sotuv, chiqit, foyda" onExport={variantRows.length ? () => doExport("Gul_turlari", () => X.variantSheet(variantExport())) : undefined}>
        {variantRows.length === 0 ? <EmptyState title="Ma'lumot yo'q" sub="Skladda partiya yo'q." /> : (
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead><tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-2 py-2 font-semibold">Gul navi</th>
                <th className="px-2 py-2 text-right font-semibold">Xarid</th>
                <th className="px-2 py-2 text-right font-semibold">Sotuvga</th>
                <th className="px-2 py-2 text-right font-semibold">Chiqit<Tip text="Chiqit dona × partiya tannarxi (cost_per_stem)." /></th>
                <th className="px-2 py-2 text-right font-semibold">Tushum<Tip text="Sotuv summasi tannarx ulushi bo'yicha navga taqsimlanadi." /></th>
                <th className="px-2 py-2 text-right font-semibold">Sof foyda / Marja</th>
              </tr></thead>
              <tbody>
                {variantRows.map((r, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--line2)" }}>
                    <td className="px-2 py-2.5 font-bold">{r.name}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.purchasedStems.toLocaleString("ru")} dona<div className="text-[11px]" style={{ color: "var(--muted)" }}>{fmt(r.purchaseSum)}</div></td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{r.soldStems.toLocaleString("ru")} dona</td>
                    <td className="px-2 py-2.5 text-right" style={{ color: r.wasteStems ? "var(--danger-ink)" : "var(--muted)" }}>{r.wasteStems ? `${r.wasteStems} dona · ${fmt(r.wasteValue)}` : "—"}</td>
                    <td className="px-2 py-2.5 text-right"><Money v={r.revenue} /></td>
                    <td className="px-2 py-2.5 text-right"><Money v={r.profit} tone={profitTone(r.profit, r.margin)} bold /> <span className="text-[11px]" style={{ color: "var(--muted)" }}>{r.revenue ? `${Math.round(r.margin)}%` : ""}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ═══ SECTION 4 — XARAJATLAR TAQSIMOTI ═══ */}
      <SectionCard n={4} icon={<TrendingDown size={18} strokeWidth={2} />} title="Xarajatlar taqsimoti" sub="pul qayerga ketdi — gullar, materiallar, florist haqi, chiqit, chegirmalar" onExport={() => doExport("Xarajatlar", () => X.breakdownSheet(breakdownExport()))}>
        {(() => {
          const items = [
            { key: "flower", label: "Gullar tannarxi", v: breakdown.flower, tip: "Sotilgan buketlar kompozitsiyasi: Σ dona × cost_per_stem.", hue: "var(--chart-1)" },
            { key: "material", label: "Materiallar tannarxi", v: breakdown.material, tip: "Σ material soni × cost_price.", hue: "var(--chart-2)" },
            { key: "fee", label: "Florist haqi", v: breakdown.fee, tip: "Σ florist_fee × sotilgan soni.", hue: "var(--chart-3)" },
          ];
          const cogs = breakdown.flower + breakdown.material + breakdown.fee || 1;
          return (
            <>
              {/* bitta stacked bar — COGS tarkibi */}
              <div className="mb-1 flex h-4 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                {items.map((it) => <div key={it.key} title={`${it.label}: ${fmt(it.v)}`} style={{ width: `${(it.v / cogs) * 100}%`, background: it.hue }} />)}
              </div>
              <p className="mb-4 text-[11.5px]" style={{ color: "var(--muted)" }}>Tannarx tarkibi (COGS): {fmt(breakdown.cogsServer)} <Mismatch on={breakdown.diverged} label="COGS split" /></p>
              <div className="flex flex-col gap-1.5">
                {items.map((it) => (
                  <div key={it.key} className="flex items-center justify-between gap-3 rounded-[11px] px-3 py-2" style={{ background: "var(--surface-2)" }}>
                    <span className="flex items-center gap-2 text-[13px] font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: it.hue }} />{it.label}<Tip text={it.tip} /></span>
                    <span className="text-[13px]"><Money v={it.v} /> <span className="text-[11px]" style={{ color: "var(--muted)" }}>· {Math.round((it.v / (breakdown.salesTotal || 1)) * 100)}%</span></span>
                  </div>
                ))}
                {/* CHIQIT — alohida, ko'zga tashlangan (real xarajat drayveri) + kengaytiriladi */}
                <div className="rounded-[11px] border-[1.5px] px-3 py-2" style={{ borderColor: "var(--danger-ink)", background: "color-mix(in srgb, var(--danger-ink) 7%, transparent)" }}>
                  <button onClick={() => setWasteOpen(!wasteOpen)} className="flex w-full items-center justify-between gap-3 text-left">
                    <span className="flex items-center gap-2 text-[13px] font-bold" style={{ color: "var(--danger-ink)" }}><TrendingDown size={15} strokeWidth={2.2} /> Chiqit yo&apos;qotishi<Tip text="Chiqit harakatlari: Σ dona × partiya cost_per_stem. Bu COGS'ga kirmaydi — alohida yo'qotish." /></span>
                    <span className="flex items-center gap-2 text-[13px] font-bold" style={{ color: "var(--danger-ink)" }}><Money v={breakdown.waste} tone="var(--danger-ink)" bold /> · {breakdown.wasteStems} dona <ChevronRight size={14} className={`transition-transform ${wasteOpen ? "rotate-90" : ""}`} /></span>
                  </button>
                  {wasteOpen && (
                    <div className="mt-2 flex flex-col gap-1 border-t pt-2" style={{ borderColor: "color-mix(in srgb, var(--danger-ink) 20%, transparent)" }}>
                      {cleanWaste.length === 0 && <p className="text-[12px]" style={{ color: "var(--muted)" }}>Bu davrda chiqit yo&apos;q.</p>}
                      {cleanWaste.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                          <span className="min-w-0 truncate">№{m.batch_detail?.batch_number} · {m.batch_detail?.variant_detail?.flower_detail?.name_uz} {m.batch_detail?.variant_detail?.name_uz}{m.reason ? ` — ${m.reason}` : ""}</span>
                          <span className="shrink-0 tabular-nums" style={{ color: "var(--danger-ink)" }}>{Math.abs(m.quantity_stems)} dona · {fmt(Math.abs(m.quantity_stems) * num(m.batch_detail?.cost_per_stem))}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* chegirma + sof foyda */}
                <div className="flex items-center justify-between gap-3 rounded-[11px] px-3 py-2" style={{ background: "var(--surface-2)" }}>
                  <span className="flex items-center gap-2 text-[13px] font-semibold">Chegirmalar<Tip text="accounting.summary.discount_total — sotuvda berilgan umumiy chegirma." /></span>
                  <span className="text-[13px]"><Money v={breakdown.discounts} tone="var(--warning-ink)" /></span>
                </div>
                <div className="mt-1 flex items-center justify-between gap-3 rounded-[12px] px-3 py-2.5" style={{ background: "color-mix(in srgb, var(--success-ink) 8%, transparent)" }}>
                  <span className="text-[14px] font-bold">Sof foyda<Tip text="Umumiy savdo − tannarx (server net_profit yig'indisi). Chiqit yo'qotishi bunga kirmaydi." /></span>
                  <Money v={breakdown.netProfit} tone={profitTone(breakdown.netProfit, breakdown.salesTotal ? (breakdown.netProfit / breakdown.salesTotal) * 100 : 0)} bold />
                </div>
              </div>
            </>
          );
        })()}
      </SectionCard>

      {/* ═══ SECTION 5 — FLORISTLAR ═══ */}
      <SectionCard n={5} icon={<Users2 size={18} strokeWidth={2} />} title="Floristlar" sub="ishlab chiqarish, oylik va yasagan mahsulotlarining foydasi" onExport={floristRows.length ? () => doExport("Floristlar", () => X.floristSheet(floristExport())) : undefined}>
        {floristRows.length === 0 ? <EmptyState title="Bu davrda florist faoliyati yo'q" sub="Boshqa davrni tanlang." /> : (
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[760px] border-collapse text-[13px]">
              <thead><tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-2 py-2 font-semibold">Florist</th>
                <th className="px-2 py-2 text-right font-semibold">Standart / Maxsus</th>
                <th className="px-2 py-2 text-right font-semibold">Ishlab chiqarish</th>
                <th className="px-2 py-2 text-right font-semibold">Oylik</th>
                <th className="px-2 py-2 text-right font-semibold">1 mahsulotga<Tip text="Oylik / jami mahsulot soni" /></th>
                <th className="px-2 py-2 text-right font-semibold">Mahsulot foydasi<Tip text="Shu florist yasagan sotuvlarning server net_profit yig'indisi." /></th>
                <th className="w-6" />
              </tr></thead>
              <tbody>
                {floristRows.map((r) => (
                  <FragmentRows key={r.id} open={openFlo === r.id}
                    row={
                      <tr onClick={() => setOpenFlo(openFlo === r.id ? null : r.id)} className="cursor-pointer border-t transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--line2)" }}>
                        <td className="px-2 py-2.5 font-bold">{r.name}<div className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>{r.staffType === "florist" ? "Florist" : "Shogird"}</div></td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{r.standard} / {r.custom}</td>
                        <td className="px-2 py-2.5 text-right"><Money v={r.productionValue} /></td>
                        <td className="px-2 py-2.5 text-right"><Money v={r.salary} /></td>
                        <td className="px-2 py-2.5 text-right"><Money v={r.avgPerItem} /></td>
                        <td className="px-2 py-2.5 text-right"><Money v={r.totalProfit} tone={profitTone(r.totalProfit, r.productionValue ? (r.totalProfit / r.productionValue) * 100 : 0)} bold /></td>
                        <td className="px-2 text-right"><ChevronRight size={15} className={`transition-transform ${openFlo === r.id ? "rotate-90" : ""}`} style={{ color: "var(--muted)" }} /></td>
                      </tr>
                    }
                    detail={
                      <div className="px-2 py-2">
                        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Oylik yozuvlari</div>
                        {(salaryByFlo.get(r.id) ?? []).length === 0 ? <p className="text-[12px]" style={{ color: "var(--muted)" }}>Yozuv yo&apos;q.</p> : (
                          <div className="flex flex-col gap-1">
                            {(salaryByFlo.get(r.id) ?? []).map((e) => (
                              <div key={e.id} className="flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5" style={{ background: "var(--surface-2)" }}>
                                <span>{fmtDate(e.work_date)} · {SALARY_SOURCE_LABEL[e.source] ?? e.source}{e.catalog_item_detail?.name_uz ? ` · ${e.catalog_item_detail.name_uz}` : ""}</span>
                                <span className="shrink-0 tabular-nums font-semibold">{fmt(e.amount)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    }
                    cols={7}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/** Kengaytiriladigan qator + detal (200ms silliq ochilish). */
function FragmentRows({ row, detail, open, cols }: { row: React.ReactNode; detail: React.ReactNode; open: boolean; cols: number }) {
  return (
    <>
      {row}
      {open && (
        <tr><td colSpan={cols} className="p-0">
          <div className="overflow-hidden" style={{ background: "color-mix(in srgb, var(--primary) 4%, transparent)" }}>{detail}</div>
        </td></tr>
      )}
    </>
  );
}

/** Section 2 detal — kompozitsiya (gul/partiya/tannarx) + materiallar + haq + reconcile. */
function CatalogDetail({ sale, item, net, cost }: { sale: import("@/lib/types").AccountingSale; item?: CatalogItem; net: number; cost: number }) {
  if (!item) return <div className="px-3 py-3 text-[12.5px]" style={{ color: "var(--muted)" }}>Kompozitsiya mavjud emas (katalog yozuvi o&apos;chirilgan). Server tannarxi: {fmt(sale.cost_total)}.</div>;
  const split = unitCostSplit(item);
  const qty = sale.quantity;
  const clientCost = split.total * qty;
  const diverged = Math.abs(clientCost - cost) > 2;
  return (
    <div className="px-3 py-3">
      <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Tarkib (1 dona × {qty})</div>
      <div className="flex flex-col gap-1">
        {item.composition.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px]" style={{ background: "var(--surface-2)" }}>
            <span className="min-w-0 truncate">{c.batch_detail?.variant_detail?.flower_detail?.name_uz} {c.batch_detail?.variant_detail?.name_uz} · №{c.batch_detail?.batch_number}</span>
            <span className="shrink-0 tabular-nums" style={{ color: "var(--text-2)" }}>{c.quantity_stems} dona × {fmt(c.batch_detail?.cost_per_stem)} = {fmt(c.quantity_stems * num(c.batch_detail?.cost_per_stem))}</span>
          </div>
        ))}
        {(item.materials ?? []).map((m) => (
          <div key={m.id} className="flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px]" style={{ background: "var(--surface-2)" }}>
            <span className="min-w-0 truncate">Material: {m.packaging_detail?.name_uz}</span>
            <span className="shrink-0 tabular-nums" style={{ color: "var(--text-2)" }}>{m.quantity} × {fmt(m.packaging_detail?.cost_price)} = {fmt(m.quantity * num(m.packaging_detail?.cost_price))}</span>
          </div>
        ))}
        <div className="flex items-center justify-between gap-2 px-2.5 py-1 text-[12.5px]">
          <span style={{ color: "var(--text-2)" }}>Florist haqi (1 dona)</span>
          <span className="tabular-nums" style={{ color: "var(--text-2)" }}>{fmt(split.fee)}</span>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 border-t pt-2 text-[12.5px]" style={{ borderColor: "var(--line2)" }}>
        <span>Gullar: <b>{fmt(split.flower * qty)}</b></span>
        <span>Materiallar: <b>{fmt(split.material * qty)}</b></span>
        <span>Haq: <b>{fmt(split.fee * qty)}</b></span>
        <span>Tannarx (klient): <b>{fmt(clientCost)}</b>{diverged && <span title="Server cost_total bilan farq — server qiymati ishlatiladi" style={{ color: "var(--danger-ink)" }}> ≠ server {fmt(cost)}</span>}</span>
        <span>Sof foyda: <b style={{ color: profitTone(net, sale.sale_total ? (net / num(sale.sale_total)) * 100 : 0) }}>{fmt(net)}</b></span>
      </div>
    </div>
  );
}
