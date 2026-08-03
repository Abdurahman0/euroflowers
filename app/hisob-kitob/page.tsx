"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FreeBatchChip from "@/components/FreeBatchChip";
import { ChevronRight, Download, Trash2, Package, Flower2, Coins, Users2, TrendingDown, BookmarkCheck, Info } from "lucide-react";
import clsx from "clsx";
import { api, ApiError } from "@/lib/api";
import { accountingCached, stockBatchesCached, invalidateReportCache, notifyReportDataChanged } from "@/lib/reportCache";
import { usePerm, useStore } from "@/lib/store";
import useAutoRefresh from "@/lib/useAutoRefresh";
import { fmt, fmtDate, dateAfterParam, dateBeforeParam } from "@/lib/format";
import { KIND_LABEL, VOLUME_LABEL, SALARY_SOURCE_LABEL } from "@/lib/inventory";
import { ARRANGEMENT_LABEL } from "@/components/badges";
import { num, saleProfit, profitTone, wasteTotals, costBreakdown, saleLineAllocations, excludeTest } from "@/lib/finance";
import { PAYMENT_METHOD_LABEL } from "@/lib/reservation";
import type { PaymentMethod } from "@/lib/types";
import { isBranchUser, accountingBranchParam, accountingRowView, branchSplitLine, type BranchSelection } from "@/lib/branch";
import * as X from "@/lib/reportExports";
import DateChips from "@/components/DateChips";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import Drawer from "@/components/Drawer";
import DatePicker from "@/components/DatePicker";
import Select from "@/components/Select";
import { Field } from "@/components/Modal";
import { Plus, Pencil } from "lucide-react";
import type { Accounting, AccountingByBranch, AccountingFigures, Analytics, Branch, CatalogItem, FloristProfile, FloristSalaryEntry, FloristStockIssue, StockBatch, StockMovement, Supplier, SupplierPayment, SupplierPaymentMethod } from "@/lib/types";

const METHOD_OPTS: { value: SupplierPaymentMethod; label: string }[] = [
  { value: "cash", label: "Naqd" }, { value: "card", label: "Karta" }, { value: "transfer", label: "O'tkazma" },
];
/** qarz rangi: 0 → sage, qisman → amber, katta → rose */
const debtTone = (outstanding: number, purchase: number) => outstanding <= 0 ? "var(--success-ink)" : (purchase > 0 && outstanding / purchase > 0.5) ? "var(--danger-ink)" : "var(--warning-ink)";

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
/** §1a: atributsiya (gul-nav/yetkazib-beruvchi) faqat asosiy filial sotuvlari bo'yicha. */
const AttrNote = () => (
  <div className="mb-3 rounded-[11px] px-3 py-2 text-[12px] font-semibold" style={{ background: "var(--surface-2)", color: "var(--muted)" }}>
    Bu ajratma <b style={{ color: "var(--text-2)" }}>faqat asosiy filial</b> sotuvlari bo&apos;yicha — filiallarda sklad yo&apos;q, filial sotuvining guli asosiy skladdan katalog yaratilganda yechilgan.
  </div>
);
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

function MiniStat({ label, value, hue }: { label: string; value: string; hue?: string }) {
  return (
    <div className="rounded-[13px] border px-3 py-2.5" style={{ borderColor: "var(--border)" }}>
      <div className="truncate text-[10.5px] font-semibold uppercase tracking-wide" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="mt-0.5 truncate text-[15px] font-extrabold tabular-nums" style={{ color: hue ?? "var(--text)" }}>{value}</div>
    </div>
  );
}

/** by_branch qatori VA summary (Jami) — YAGONA renderer (accountingRowView). Tannarx
    ostida gul/material/xizmat ajratmasi tooltip'da. ⚠️ florist_fee_cost = MIJOZDAN
    olinadigan floristika XIZMATI (tannarx qismi), florist OYLIGI emas. */
function BranchRow({ fig, footer }: { fig: AccountingFigures; footer?: boolean }) {
  const v = accountingRowView(fig);
  const tannarxTip = `Gul ${fmt(v.flowerCost)} · Material ${fmt(v.materialCost)} · Floristika xizmati ${fmt(v.feeCost)}`;
  return (
    <tr className={footer ? "border-t-2 font-bold" : "border-t"} style={{ borderColor: footer ? "var(--border-strong)" : "var(--line2)" }}>
      <td className="max-w-[220px] truncate px-2 py-2.5 font-bold" title={v.name}>{footer ? "Jami" : v.name}</td>
      <td className="px-2 py-2.5 text-right tabular-nums">{v.salesCount}</td>
      <td className="px-2 py-2.5 text-right tabular-nums">{v.buket}</td>
      <td className="px-2 py-2.5 text-right tabular-nums">{v.stems.toLocaleString("ru")}</td>
      <td className="px-2 py-2.5 text-right"><Money v={v.sales} bold /></td>
      <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--text-2)" }}>{fmt(v.cash)}</td>
      <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--text-2)" }}>{fmt(v.card)}</td>
      <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: v.discount > 0 ? "var(--warning-ink)" : "var(--muted)" }}>{v.discount > 0 ? fmt(v.discount) : "—"}</td>
      <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--text-2)" }} title={tannarxTip}><span className="cursor-help underline decoration-dotted underline-offset-2">{fmt(v.cost)}</span></td>
      <td className="px-2 py-2.5 text-right"><Money v={v.net} tone={profitTone(v.net, v.sales ? (v.net / v.sales) * 100 : 0)} bold /></td>
      <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--muted)" }}>{v.share}%</td>
    </tr>
  );
}

type SortKey = "net" | "margin" | "date";

export default function HisobKitobPage() {
  const { dateFilter, dateRange, showToast } = useStore();
  const { canView } = usePerm();
  const visible = canView("dashboard");

  const [acc, setAcc] = useState<Accounting | null>(null);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [waste, setWaste] = useState<StockMovement[]>([]);
  // FLORIST QO'LIDAGI CHIQIT — sklad chiqiti bilan ALOHIDA ko'rsatiladi, JAMLANMAYDI.
  // TODO(branch-parkent §2b): backend florist waste uchun warehouse waste movement
  //   yozadimi — READ-ONLY tekshirib bo'lmadi (0 yozuv). Qo'lda tasdiqlangach, agar
  //   yozmasa BU YERDA jamlash mumkin; yozsa — ikki marta sanamaslik uchun ayirish kerak.
  const [floristWaste, setFloristWaste] = useState<FloristStockIssue[]>([]);
  const [prod, setProd] = useState<Analytics["florist_production_stats"]>([]);
  const [salary, setSalary] = useState<FloristSalaryEntry[]>([]);
  // §5: bron to'lovlari (zaklad cashflow) — reservations'dan tekislab, davr bo'yicha filtrlaymiz
  const [resvPays, setResvPays] = useState<{ id: number; date: string; amount: number; method: PaymentMethod; customer: string; request: string; reservationId: number }[]>([]);
  const [err, setErr] = useState("");

  const [catSort, setCatSort] = useState<SortKey>("net");
  const [catGrouped, setCatGrouped] = useState(false);
  const [openCat, setOpenCat] = useState<number | null>(null);
  const [openSup, setOpenSup] = useState<number | null>(null);
  const [openFlo, setOpenFlo] = useState<number | null>(null);
  const [wasteOpen, setWasteOpen] = useState(false);
  const [includeTest, setIncludeTest] = useState(false); // dev-toggle: ZZZ_TEST_ yozuvlarni qo'shish
  const [supSort, setSupSort] = useState<"outstanding" | "purchase" | "last">("outstanding");
  const [payDrawer, setPayDrawer] = useState<{ supplierId: number; edit?: SupplierPayment } | null>(null);
  // FILIAL AJRATMASI — segmentli tanlov (Hammasi/Toshkent/<filial>). Filial foydalanuvchisiga
  // KO'RSATILMAYDI (server o'zi cheklaydi). Sarlavha branch_filter'dan (klient state'dan emas).
  const branchUser = isBranchUser(useStore((s) => s.user?.profile.branch));
  const [branchSel, setBranchSel] = useState<BranchSelection>("all");
  const [histBranch, setHistBranch] = useState(""); // §2 sotuvlar jadvali filiali (nom bo'yicha)
  const [branches, setBranches] = useState<Branch[]>([]);
  useEffect(() => { api.branches({ is_active: true }).then(setBranches).catch(() => {}); }, []);
  const branchParam = accountingBranchParam(branchSel);

  const from = dateRange ? dateRange.from : dateAfterParam(dateFilter);
  const to = dateRange ? dateRange.to : ymd(new Date());

  const load = useCallback(() => {
    if (!visible) return;
    accountingCached(from, to, branchParam).then((d) => { setAcc(d); setErr(""); }).catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi"));
    api.catalog().then(setCatalog).catch(() => setCatalog([]));
    stockBatchesCached().then(setBatches).catch(() => setBatches([]));
    api.suppliers().then(setSuppliers).catch(() => setSuppliers([]));
    api.supplierPayments().then(setPayments).catch(() => setPayments([]));
    api.stockMovements({ movement_type: "waste", created_at_after: from, created_at_before: dateBeforeParam(to), page_size: 200 }).then(setWaste).catch(() => setWaste([]));
    api.floristStockIssues({ kind: "waste", created_at_after: from, created_at_before: dateBeforeParam(to), page_size: 200 }).then(setFloristWaste).catch(() => setFloristWaste([]));
    api.analytics({ from, to }).then((a) => setProd(a.florist_production_stats ?? [])).catch(() => setProd([]));
    api.floristSalary().then(setSalary).catch(() => setSalary([]));
    // BRON TO'LOVLARI — barcha bronlar payments'ini tekislab, to'langan sanasi davr ichida bo'lganini olamiz
    api.reservations({ page_size: 200 }).then((rs) => {
      const out: typeof resvPays = [];
      for (const r of rs) for (const p of r.payments ?? []) {
        const raw = p.paid_at || p.created_at || "";
        const d = raw.slice(0, 10);
        if (d && d >= from && d <= to) out.push({ id: p.id, date: raw, amount: Math.round(+p.amount || 0), method: p.method, customer: r.customer_detail?.name || r.customer_name || `Bron #${r.id}`, request: r.request_uz || "", reservationId: r.id });
      }
      out.sort((a, b) => (a.date < b.date ? 1 : -1));
      setResvPays(out);
    }).catch(() => setResvPays([]));
  }, [visible, from, to, branchParam]);

  // to'lov CRUD dan keyin — suppliers (rollup) va payments qayta yuklanadi
  const refreshSuppliers = useCallback(() => {
    api.suppliers().then(setSuppliers).catch(() => {});
    api.supplierPayments().then(setPayments).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  useAutoRefresh(load);
  useEffect(() => {
    const h = () => { invalidateReportCache(); load(); }; // event kelganda kesh ham tozalanadi (WS push himoyasi)
    window.addEventListener("ef:stock-changed", h);
    return () => window.removeEventListener("ef:stock-changed", h);
  }, [load]);

  const catalogById = useMemo(() => new Map(catalog.map((i) => [i.id, i])), [catalog]);
  // GUARD: ZZZ_TEST_ yozuvlar hisobotdan chiqariladi (dev-toggle bilan qaytariladi).
  // Backend test partiyalari/harakatlarini o'chira olmaydi (soft-delete/405) — shu filtr himoya.
  const sales = useMemo(() => excludeTest(acc?.history ?? [], (s) => s.catalog_name, includeTest), [acc, includeTest]);
  // ⚠️ ATRIBUTSIYA (gul-nav/yetkazib-beruvchi) FAQAT asosiy filial sotuvlari bo'yicha:
  // filiallarda sklad yo'q, filial sotuvining guli ASOSIY skladdan katalog yaratilganda
  // yechilgan. saleLineAllocations filial sotuvi uchun bo'sh qaytaradi (item topilmaydi) —
  // shu bois ikki marta sanalmaydi; biz buni ATAYLAB qilamiz va panelni belgilaymiz.
  const mainSales = useMemo(() => sales.filter((s) => s.is_main_branch !== false), [sales]);
  // "all" rejimda filial sotuvi bormi (atributsiya panellariga izoh kerakmi)
  const hasBranchSales = useMemo(() => sales.some((s) => s.is_main_branch === false), [sales]);
  const branchMode = acc?.branch_filter?.mode ?? "all";
  const cleanBatches = useMemo(() => excludeTest(batches, (b) => b.batch_number, includeTest), [batches, includeTest]);
  const cleanWaste = useMemo(() => excludeTest(waste, (m) => m.batch_detail?.batch_number, includeTest), [waste, includeTest]);
  // FLORIST QO'LIDAGI CHIQIT jami — ALOHIDA ko'rsatiladi, sklad chiqitiga QO'SHILMAYDI
  const floristWasteTotal = useMemo(() => ({
    stems: floristWaste.reduce((s, w) => s + w.quantity_stems, 0),
    value: floristWaste.reduce((s, w) => s + w.quantity_stems * (+(w.batch_detail?.cost_per_stem ?? 0) || 0), 0),
  }), [floristWaste]);

  // ── Section 6: bron to'lovlari (zaklad cashflow) ─────────────────
  const resvTotals = useMemo(() => {
    const t = { count: resvPays.length, total: 0, cash: 0, card: 0, transfer: 0 };
    for (const p of resvPays) { t.total += p.amount; if (p.method === "cash") t.cash += p.amount; else if (p.method === "card") t.card += p.amount; else t.transfer += p.amount; }
    return t;
  }, [resvPays]);

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
  const paymentsBySupplier = useMemo(() => {
    const m = new Map<number, SupplierPayment[]>();
    for (const p of payments) { const arr = m.get(p.supplier) ?? []; arr.push(p); m.set(p.supplier, arr); }
    return m;
  }, [payments]);

  const supplierData = useMemo(() => {
    // TUSHUM/FOYDA/CHIQIT — klient atributsiyasi (cost-share); XARID/TO'LOV/QARZ — SERVER rollup
    const allocs = mainSales.flatMap((s) => saleLineAllocations(s, catalogById.get(s.catalog_id)));
    type Attr = { revenue: number; cost: number; wasteStems: number; wasteCost: number };
    const attr = new Map<number, Attr>();
    const ens = (id: number): Attr => { let a = attr.get(id); if (!a) { a = { revenue: 0, cost: 0, wasteStems: 0, wasteCost: 0 }; attr.set(id, a); } return a; };
    for (const l of allocs) if (l.supplierId != null) { const a = ens(l.supplierId); a.revenue += l.revenue; a.cost += l.cost; }
    for (const m of cleanWaste) { const sid = m.batch_detail?.supplier ?? null; if (sid != null) { const a = ens(sid); a.wasteStems += Math.abs(m.quantity_stems); a.wasteCost += num(m.cost_value); } }
    const rows = suppliers.map((s) => {
      const a = attr.get(s.id) ?? { revenue: 0, cost: 0, wasteStems: 0, wasteCost: 0 };
      const profit = a.revenue - a.cost;
      return {
        id: s.id, name: s.name,
        purchase: num(s.purchase_total), paid: num(s.paid_total), outstanding: num(s.outstanding), lastPaymentAt: s.last_payment_at ?? null,
        revenue: a.revenue, cost: a.cost, profit, margin: a.revenue ? (profit / a.revenue) * 100 : 0,
        wasteStems: a.wasteStems, wasteCost: a.wasteCost,
      };
    });
    rows.sort((x, y) => supSort === "purchase" ? y.purchase - x.purchase
      : supSort === "last" ? (+new Date(y.lastPaymentAt ?? 0)) - (+new Date(x.lastPaymentAt ?? 0))
      : y.outstanding - x.outstanding);
    return { rows, anySupplier: suppliers.length > 0 };
  }, [mainSales, catalogById, cleanWaste, suppliers, supSort]);

  // ── Section 3: gul turlari (variant) ─────────────────────────────
  const variantRows = useMemo(() => {
    type Agg = { name: string; purchasedStems: number; purchaseSum: number; soldStems: number; revenue: number; cost: number; wasteStems: number; wasteValue: number };
    const agg = new Map<number, Agg>();
    const label = (b?: StockBatch) => b ? `${b.variant_detail?.flower_detail?.name_uz ?? ""} ${b.variant_detail?.name_uz ?? ""}${b.variant_detail?.color_uz ? ` (${b.variant_detail.color_uz})` : ""}`.trim() : "—";
    const ensure = (id: number, nm: string): Agg => { let a = agg.get(id); if (!a) { a = { name: nm, purchasedStems: 0, purchaseSum: 0, soldStems: 0, revenue: 0, cost: 0, wasteStems: 0, wasteValue: 0 }; agg.set(id, a); } return a; };
    for (const b of cleanBatches) { const a = ensure(b.variant, label(b)); a.purchasedStems += b.received_stems; a.purchaseSum += b.received_stems * num(b.cost_per_stem); }
    for (const s of mainSales) for (const l of saleLineAllocations(s, catalogById.get(s.catalog_id))) if (l.variantId != null) { const a = ensure(l.variantId, agg.get(l.variantId)?.name ?? "—"); a.soldStems += l.stems; a.revenue += l.revenue; a.cost += l.cost; }
    for (const m of cleanWaste) { const vid = m.batch_detail?.variant; if (vid != null) { const a = ensure(vid, label(m.batch_detail)); const q = Math.abs(m.quantity_stems); a.wasteStems += q; a.wasteValue += q * num(m.batch_detail?.cost_per_stem); } }
    return Array.from(agg.values()).map((a) => ({ ...a, profit: a.revenue - a.cost, margin: a.revenue ? ((a.revenue - a.cost) / a.revenue) * 100 : 0 })).sort((x, y) => y.profit - x.profit);
  }, [cleanBatches, mainSales, catalogById, cleanWaste]);

  // ── Section 4: xarajatlar taqsimoti ──────────────────────────────
  const breakdown = useMemo(() => costBreakdown(sales, cleanWaste, num(acc?.summary.discount_total)), [sales, cleanWaste, acc]);

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
  const supplierExport = (): X.SupplierRow[] => supplierData.rows.map((r) => ({ name: r.name, receivedStems: 0, purchase: r.purchase, paid: r.paid, debt: r.outstanding, revenue: r.revenue, profit: r.profit, margin: Math.round(r.margin), wasteStems: r.wasteStems, wasteValue: r.wasteCost }));
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
  const reservationExport = (): X.ReservationPaymentRow[] => resvPays.map((p) => ({ paidAt: fmtDate(p.date), customer: p.customer, request: p.request, method: PAYMENT_METHOD_LABEL[p.method], amount: p.amount }));
  const doExportAll = () => {
    // FILIALLAR varag'i (by_branch bo'lsa) + fayl nomiga joriy filial rejimi
    const bb = acc?.by_branch ?? [];
    const branchSheets = bb.length ? [X.branchSheet(bb, acc!.summary)] : [];
    const branchLabel = acc?.branch_filter?.mode === "branch" ? (acc.branch_filter.branch_name ?? "Filial") : acc?.branch_filter?.mode === "main" ? "Toshkent" : "Hammasi";
    const resvSheets = resvPays.length ? [X.reservationSheet(reservationExport())] : [];
    return X.exportAll([...branchSheets, X.supplierSheet(supplierExport()), X.catalogSheet(catalogExport()), X.variantSheet(variantExport()), X.breakdownSheet(breakdownExport()), X.floristSheet(floristExport()), ...resvSheets], from, to, branchLabel).then(() => showToast("✓ Barchasi yuklab olindi")).catch(() => showToast("Eksport qilib bo'lmadi"));
  };
  const doExport = (label: string, sheet: () => import("@/lib/xlsx").SheetDef) => X.exportSection(label, sheet(), from, to).then(() => showToast("✓ Excel yuklab olindi")).catch(() => showToast("Eksport qilib bo'lmadi"));

  const deletePayment = async (p: SupplierPayment) => {
    try { await api.deleteSupplierPayment(p.id); showToast("✓ To'lov o'chirildi"); invalidateReportCache(); refreshSuppliers(); }
    catch (e) { showToast(e instanceof ApiError ? e.message : "O'chirib bo'lmadi"); }
  };

  if (!visible) return <div className="mt-10"><EmptyState title="Ruxsat yo'q" sub="Hisob-kitobni ko'rish uchun ruxsatingiz yo'q." /></div>;
  if (err) return <p className="mt-10 text-center text-sm font-bold" style={{ color: "var(--danger-ink)" }}>{err}</p>;
  if (!acc) return <FlowerLoader />;

  const s = acc.summary;
  const byBranch = acc.by_branch ?? [];
  // ⚠️ SARLAVHA branch_filter'dan (klient state'dan EMAS) — yorliq server qaytargan bilan mos.
  const bf = acc.branch_filter;
  const branchTitle = bf?.mode === "branch" ? (bf.branch_name ?? "Filial") : bf?.mode === "main" ? "Toshkent (asosiy filial)" : "Barcha filiallar";
  // §5: Filial ustuni FAQAT "all" rejimda VA filial sotuvi bo'lsa (bir xil qiymatli ustun clutter)
  const showBranchCol = branchMode === "all" && hasBranchSales;
  const histBranchNames = Array.from(new Set(sales.map((x) => x.branch_name).filter(Boolean))) as string[];
  const shownCatRows = histBranch ? catRows.filter((r) => r.s.branch_name === histBranch) : catRows;

  return (
    <div className="relative flex flex-col gap-5">
      {/* sarlavha + davr + Barchasi eksport */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 text-[15px] font-bold" style={{ color: "var(--text-2)" }}>
            Hisob-kitob — pul qayerda
            <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--primary-soft)", color: "var(--primary)" }}>{branchTitle}</span>
          </h2>
          <p className="text-[12px] font-medium" style={{ color: "var(--muted)" }}>server avtoritativ · klient hisoblari tekshirilgan (lib/finance)</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {DEV && (
            <label className="flex cursor-pointer items-center gap-1.5 rounded-[11px] border px-2.5 py-1.5 text-[12px] font-semibold" style={{ borderColor: "var(--border)", color: "var(--muted)" }} title="Dev: ZZZ_TEST_ yozuvlarni hisobotga qo'shish (odatda chiqarilgan)">
              <input type="checkbox" checked={includeTest} onChange={(e) => setIncludeTest(e.target.checked)} className="h-3.5 w-3.5 accent-[var(--primary)]" />
              Test yozuvlar
            </label>
          )}
          {/* FILIAL TANLASH — segmentli. Filial foydalanuvchisiga KO'RSATILMAYDI. */}
          {!branchUser && branches.length > 0 && (
            <div className="flex items-center gap-1 rounded-[12px] p-1" style={{ background: "var(--surface-2)" }}>
              {([{ k: "all" as BranchSelection, label: "Hammasi" }, { k: "main" as BranchSelection, label: "Toshkent" }, ...branches.filter((b) => !b.is_main).map((b) => ({ k: b.id as BranchSelection, label: b.name.replace(" filiali", "") }))]).map((o) => (
                <button key={String(o.k)} type="button" onClick={() => setBranchSel(o.k)} className="rounded-[9px] px-3 py-1.5 text-[12.5px] font-bold transition-colors" style={{ background: branchSel === o.k ? "var(--surface-solid)" : "transparent", color: branchSel === o.k ? "var(--primary)" : "var(--muted)" }}>{o.label}</button>
              ))}
            </div>
          )}
          <DateChips />
          <button onClick={doExportAll} className="flex items-center gap-1.5 rounded-[13px] px-3.5 py-2 text-[13px] font-bold text-white transition-opacity hover:opacity-90" style={{ background: "var(--primary)" }} title="Barcha bo'limlar — bitta Excel kitobi (joriy filial + davr)">
            <Download size={15} strokeWidth={2} /> Barchasi
          </button>
        </div>
      </div>

      {/* KPI qatori — sarlavha filial rejimi bilan; pul kartochkalari ostida ajratma (faqat Hammasi) */}
      {(() => {
        const showSplit = branchMode === "all" && byBranch.length > 1;
        const moneyShort = (v: number) => String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
        const split = (field: keyof AccountingFigures) => (showSplit ? branchSplitLine(byBranch, field, moneyShort) : null);
        const cards: { label: string; v: string; sub: string; hue?: string; splitField?: keyof AccountingFigures }[] = [
          { label: "Umumiy savdo", v: fmt(s.total_sales), sub: `${s.sales_count ?? s.total_quantity} sotuv · ${s.total_quantity} buket`, splitField: "total_sales" },
          { label: "Sotuvlar soni", v: String(s.sales_count ?? s.total_quantity), sub: "marta sotildi" },
          { label: "Sotilgan buket", v: String(s.total_quantity), sub: `${s.standard_quantity} std · ${s.custom_quantity} maxsus` },
          { label: "Sotilgan gul donasi", v: `${(s.flower_stems ?? 0).toLocaleString("ru")} dona`, sub: "gul sarfi" },
          { label: "Naqd", v: fmt(s.cash_total), sub: `${s.cash_count ?? 0} sotuv`, splitField: "cash_total" },
          { label: "Karta", v: fmt(s.card_total), sub: `${s.card_count ?? 0} sotuv`, splitField: "card_total" },
          { label: "Skidka", v: fmt(s.discount_total), sub: `${s.discounted_sales_count} sotuvda`, splitField: "discount_total" },
          { label: "Sof foyda", v: fmt(s.net_profit), sub: `tannarx ${fmt(s.cost_total)}`, hue: profitTone(num(s.net_profit), num(s.total_sales) ? (num(s.net_profit) / num(s.total_sales)) * 100 : 0), splitField: "net_profit" },
        ];
        return (
          <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))" }}>
            {cards.map((k) => {
              const sp = k.splitField ? split(k.splitField) : null;
              return (
                <div key={k.label} className="glass flex flex-col !rounded-[16px] p-4">
                  <div className="text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{k.label}</div>
                  <div className="mt-1.5 whitespace-nowrap text-[20px] font-extrabold tracking-tight" style={{ color: k.hue ?? "var(--text)" }}>{k.v}</div>
                  <div className="mt-0.5 text-[12px] font-medium" style={{ color: "var(--text-2)" }}>{k.sub}</div>
                  {sp && <div className="mt-1 truncate border-t pt-1 text-[11px] font-semibold" style={{ borderColor: "var(--line2)", color: "var(--muted)" }} title={sp}>{sp}</div>}
                </div>
              );
            })}
          </div>
        );
      })()}

      {/* ═══ FILIALLAR JADVALI — by_branch (bitta row-renderer, summary = Jami) ═══ */}
      {byBranch.length > 0 && (
        <section className="glass !rounded-[18px] p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-[15px] font-bold tracking-tight">Filiallar bo&apos;yicha</h3>
            <Link href="/filial-hisoboti" className="text-[12px] font-bold" style={{ color: "var(--primary)" }}>Filial hisoboti (yuborilgan · ustama) →</Link>
          </div>
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[900px] border-collapse text-[13px]">
              <thead><tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-2 py-2 font-semibold">Filial</th>
                <th className="px-2 py-2 text-right font-semibold">Sotuv</th>
                <th className="px-2 py-2 text-right font-semibold">Buket</th>
                <th className="px-2 py-2 text-right font-semibold">Gul donasi</th>
                <th className="px-2 py-2 text-right font-semibold">Savdo</th>
                <th className="px-2 py-2 text-right font-semibold">Naqd</th>
                <th className="px-2 py-2 text-right font-semibold">Karta</th>
                <th className="px-2 py-2 text-right font-semibold">Skidka</th>
                <th className="px-2 py-2 text-right font-semibold">Tannarx</th>
                <th className="px-2 py-2 text-right font-semibold">Sof foyda</th>
                <th className="px-2 py-2 text-right font-semibold">Ulush</th>
              </tr></thead>
              <tbody>
                {byBranch.map((b, i) => <BranchRow key={b.branch_id ?? `m${i}`} fig={b} />)}
              </tbody>
              <tfoot><BranchRow fig={s} footer /></tfoot>
            </table>
          </div>
        </section>
      )}

      {/* ═══ SECTION 1 — YETKAZIB BERUVCHILAR (to'lovlar bilan) ═══ */}
      <SectionCard n={1} icon={<Package size={18} strokeWidth={2} />} title="Yetkazib beruvchilar" sub="qarz, to'lovlar, tushum va foyda — qatorni ochib to'lovlar tarixini ko'ring" onExport={supplierData.rows.length ? () => doExport("Yetkazib_beruvchilar", () => X.supplierSheet(supplierExport())) : undefined}>
        {hasBranchSales && <AttrNote />}
        {!supplierData.anySupplier ? (
          <div className="rounded-[14px] border border-dashed p-6 text-center" style={{ borderColor: "var(--border)" }}>
            <p className="text-[14px] font-bold">Yetkazib beruvchi yo&apos;q</p>
            <p className="mx-auto mt-1 max-w-md text-[13px]" style={{ color: "var(--muted)" }}>Xarid, qarz va to&apos;lovlarni ko&apos;rish uchun avval yetkazib beruvchi qo&apos;shing va sklad partiyalariga biriktiring.</p>
            <Link href="/suppliers" className="mt-3 inline-block rounded-[11px] px-4 py-2 text-[13px] font-bold text-white" style={{ background: "var(--primary)" }}>Yetkazib beruvchilar →</Link>
          </div>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1 rounded-[11px] p-1" style={{ background: "var(--surface-2)" }}>
                {([["outstanding", "Qarz"], ["purchase", "Xarid"], ["last", "Oxirgi to'lov"]] as [typeof supSort, string][]).map(([k, lbl]) => (
                  <button key={k} onClick={() => setSupSort(k)} className="rounded-[8px] px-2.5 py-1 text-[12px] font-bold transition-colors" style={{ background: supSort === k ? "var(--surface-solid)" : "transparent", color: supSort === k ? "var(--primary)" : "var(--muted)" }}>{lbl}</button>
                ))}
              </div>
              <button onClick={() => setPayDrawer({ supplierId: supplierData.rows[0]?.id ?? 0 })} className="flex items-center gap-1.5 rounded-[11px] px-3 py-1.5 text-[12.5px] font-bold text-white transition-opacity hover:opacity-90" style={{ background: "var(--primary)" }}>
                <Plus size={15} strokeWidth={2.2} /> To&apos;lov qo&apos;shish
              </button>
            </div>
            <div className="overflow-x-auto thin-scroll">
              <table className="w-full min-w-[900px] border-collapse text-[13px]">
                <thead>
                  <tr className="text-left" style={{ color: "var(--muted)" }}>
                    <th className="px-2 py-2 font-semibold">Yetkazib beruvchi</th>
                    <th className="px-2 py-2 text-right font-semibold">Xarid summasi</th>
                    <th className="px-2 py-2 text-right font-semibold">To&apos;langan</th>
                    <th className="px-2 py-2 text-right font-semibold">QARZ</th>
                    <th className="px-2 py-2 text-right font-semibold">Oxirgi to&apos;lov</th>
                    <th className="px-2 py-2 text-right font-semibold">Tushum<Tip text="Sotuv summasi har bir gul qatoriga tannarx ulushi bo'yicha taqsimlanadi." /></th>
                    <th className="px-2 py-2 text-right font-semibold">Foyda</th>
                    <th className="px-2 py-2 text-right font-semibold">Chiqit</th>
                    <th className="w-6" />
                  </tr>
                </thead>
                <tbody>
                  {supplierData.rows.map((r) => {
                    const pays = paymentsBySupplier.get(r.id) ?? [];
                    return (
                    <FragmentRows key={r.id} open={openSup === r.id}
                      row={
                        <tr onClick={() => setOpenSup(openSup === r.id ? null : r.id)} className="cursor-pointer border-t transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--line2)" }}>
                          <td className="px-2 py-2.5 font-bold">{r.name}</td>
                          <td className="px-2 py-2.5 text-right"><Money v={r.purchase} /></td>
                          <td className="px-2 py-2.5 text-right" style={{ color: "var(--text-2)" }}><Money v={r.paid} /></td>
                          <td className="px-2 py-2.5 text-right"><Money v={r.outstanding} tone={debtTone(r.outstanding, r.purchase)} bold /></td>
                          <td className="px-2 py-2.5 text-right tabular-nums" style={{ color: "var(--muted)" }}>{r.lastPaymentAt ? fmtDate(r.lastPaymentAt) : "—"}</td>
                          <td className="px-2 py-2.5 text-right"><Money v={r.revenue} /></td>
                          <td className="px-2 py-2.5 text-right"><Money v={r.profit} tone={profitTone(r.profit, r.margin)} bold /> <span className="text-[11px]" style={{ color: "var(--muted)" }}>{r.revenue ? `${Math.round(r.margin)}%` : ""}</span></td>
                          <td className="px-2 py-2.5 text-right" style={{ color: r.wasteStems ? "var(--danger-ink)" : "var(--muted)" }}>{r.wasteStems ? fmt(r.wasteCost) : "—"}</td>
                          <td className="px-2 text-right"><ChevronRight size={15} className={`transition-transform ${openSup === r.id ? "rotate-90" : ""}`} style={{ color: "var(--muted)" }} /></td>
                        </tr>
                      }
                      detail={
                        <div className="px-3 py-3">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>To&apos;lovlar tarixi</span>
                            <button onClick={() => setPayDrawer({ supplierId: r.id })} className="flex items-center gap-1 rounded-[9px] border px-2 py-1 text-[11.5px] font-bold" style={{ borderColor: "var(--border-strong)", color: "var(--primary)" }}><Plus size={12} strokeWidth={2.4} /> To&apos;lov</button>
                          </div>
                          {pays.length === 0 ? <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>Hali to&apos;lov yo&apos;q.</p> : (
                            <div className="flex flex-col gap-1">
                              {pays.map((p) => (
                                <div key={p.id} className="flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px]" style={{ background: "var(--surface-2)" }}>
                                  <span className="flex min-w-0 items-center gap-2">
                                    <span className="tabular-nums font-semibold">{fmtDate(p.paid_at)}</span>
                                    <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--hover)", color: "var(--text-2)" }}>{p.method_label}</span>
                                    {p.note && <span className="truncate" style={{ color: "var(--muted)" }}>{p.note}</span>}
                                    {p.created_by_detail && <span className="shrink-0 text-[11px]" style={{ color: "var(--muted)" }}>· {[p.created_by_detail.first_name, p.created_by_detail.last_name].filter(Boolean).join(" ") || p.created_by_detail.username}</span>}
                                  </span>
                                  <span className="flex shrink-0 items-center gap-2">
                                    <b className="tabular-nums">{fmt(p.amount)}</b>
                                    <button onClick={() => setPayDrawer({ supplierId: r.id, edit: p })} className="opacity-60 hover:opacity-100" title="Tahrirlash"><Pencil size={13} /></button>
                                    <button onClick={() => deletePayment(p)} className="opacity-60 hover:opacity-100" style={{ color: "var(--danger-ink)" }} title="O'chirish"><Trash2 size={13} /></button>
                                  </span>
                                </div>
                              ))}
                              <div className="mt-1 flex items-center justify-between px-2.5 text-[12.5px] font-bold">
                                <span>Qoldiq (qarz)</span>
                                <span className="tabular-nums" style={{ color: debtTone(r.outstanding, r.purchase) }}>{fmt(r.outstanding)}</span>
                              </div>
                            </div>
                          )}
                        </div>
                      }
                      cols={9}
                    />
                  ); })}
                </tbody>
              </table>
            </div>
          </>
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
          {/* §5: filial bo'yicha filtr — faqat "all" rejimda va filial sotuvi bo'lsa */}
          {showBranchCol && !catGrouped && histBranchNames.length > 1 && (
            <div className="flex items-center gap-1 rounded-[11px] p-1" style={{ background: "var(--surface-2)" }}>
              <button onClick={() => setHistBranch("")} className="rounded-[8px] px-2.5 py-1 text-[12px] font-bold" style={{ background: !histBranch ? "var(--surface-solid)" : "transparent", color: !histBranch ? "var(--primary)" : "var(--muted)" }}>Barchasi</button>
              {histBranchNames.map((nm) => (
                <button key={nm} onClick={() => setHistBranch(nm)} className="rounded-[8px] px-2.5 py-1 text-[12px] font-bold" style={{ background: histBranch === nm ? "var(--surface-solid)" : "transparent", color: histBranch === nm ? "var(--primary)" : "var(--muted)" }} title={nm}>{nm.replace(" filiali", "").replace(" (asosiy filial)", "")}</button>
              ))}
            </div>
          )}
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
            <table className="w-full min-w-[900px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left" style={{ color: "var(--muted)" }}>
                  <th className="px-2 py-2 font-semibold">Nomi</th>
                  {showBranchCol && <th className="px-2 py-2 font-semibold">Filial</th>}
                  <th className="px-2 py-2 font-semibold">Florist</th>
                  <th className="px-2 py-2 font-semibold">Mijoz</th>
                  <th className="px-2 py-2 text-right font-semibold">Sotilgan</th>
                  <th className="px-2 py-2 text-right font-semibold">Sotuv</th>
                  <th className="px-2 py-2 text-right font-semibold">Tannarx</th>
                  <th className="px-2 py-2 text-right font-semibold">Chegirma</th>
                  <th className="px-2 py-2 text-right font-semibold">Sof foyda / Marja</th>
                  <th className="w-6" />
                </tr>
              </thead>
              <tbody>
                {shownCatRows.map(({ s: sale, p, item }) => (
                  <FragmentRows key={sale.history_id} open={openCat === sale.history_id}
                    row={
                      <tr onClick={() => setOpenCat(openCat === sale.history_id ? null : sale.history_id)} className="cursor-pointer border-t transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--line2)" }}>
                        <td className="px-2 py-2.5"><div className="font-bold">{sale.catalog_name}</div><div className="text-[11px]" style={{ color: "var(--muted)" }}>{ARRANGEMENT_LABEL[sale.arrangement_type as keyof typeof ARRANGEMENT_LABEL] ?? sale.arrangement_type}{sale.volume ? ` · ${VOLUME_LABEL[sale.volume]}` : ""} · {KIND_LABEL[sale.catalog_kind]}</div></td>
                        {showBranchCol && <td className="px-2 py-2.5"><span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: sale.is_main_branch === false ? "color-mix(in srgb, var(--acc) 14%, transparent)" : "var(--surface-2)", color: sale.is_main_branch === false ? "var(--acc)" : "var(--text-2)" }}>{sale.branch_name || "—"}</span></td>}
                        <td className="px-2 py-2.5">{sale.florist_name || "—"}</td>
                        <td className="px-2 py-2.5">{item?.customer_detail ? (<div><div className="font-semibold">{item.customer_detail.name || "Mijoz"}</div>{item.customer_detail.masked_phone && <div className="text-[11px]" style={{ color: "var(--muted)" }}>{item.customer_detail.masked_phone}</div>}</div>) : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                        <td className="px-2 py-2.5 text-right tabular-nums">{fmtDate(sale.sold_at)}<div className="text-[11px]" style={{ color: "var(--muted)" }}>{sale.quantity} ta{sale.flower_stems ? ` · ${sale.flower_stems} gul` : ""}</div></td>
                        <td className="px-2 py-2.5 text-right"><Money v={p.sale} /></td>
                        <td className="px-2 py-2.5 text-right" style={{ color: "var(--text-2)" }}><Money v={p.cost} /></td>
                        <td className="px-2 py-2.5 text-right" style={{ color: p.discount ? "var(--warning-ink)" : "var(--muted)" }}>{p.discount ? fmt(p.discount) : "—"}</td>
                        <td className="px-2 py-2.5 text-right"><Money v={p.net} tone={profitTone(p.net, p.margin)} bold /><Mismatch on={p.diverged} label="net_profit" /> <span className="text-[11px]" style={{ color: "var(--muted)" }}>{Math.round(p.margin)}%</span></td>
                        <td className="px-2 text-right"><ChevronRight size={15} className={`transition-transform ${openCat === sale.history_id ? "rotate-90" : ""}`} style={{ color: "var(--muted)" }} /></td>
                      </tr>
                    }
                    detail={<CatalogDetail sale={sale} item={item} net={p.net} />}
                    cols={showBranchCol ? 10 : 9}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ═══ SECTION 3 — GUL TURLARI ═══ */}
      <SectionCard n={3} icon={<Flower2 size={18} strokeWidth={2} />} title="Gul turlari bo'yicha" sub="qaysi nav pul keltiryapti, qaysisi zarar — xarid, sotuv, chiqit, foyda" onExport={variantRows.length ? () => doExport("Gul_turlari", () => X.variantSheet(variantExport())) : undefined}>
        {hasBranchSales && <AttrNote />}
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
            { key: "flower", label: "Gullar tannarxi", v: breakdown.flower, tip: "Server: sotuvlarning flower_cost yig'indisi (Σ dona × cost_per_stem).", hue: "var(--chart-1)" },
            { key: "material", label: "Materiallar tannarxi", v: breakdown.material, tip: "Server: sotuvlarning material_cost yig'indisi.", hue: "var(--chart-2)" },
            { key: "fee", label: "Florist haqi", v: breakdown.fee, tip: "Server: sotuvlarning florist_fee_cost yig'indisi.", hue: "var(--chart-3)" },
          ];
          const cogs = breakdown.flower + breakdown.material + breakdown.fee || 1;
          return (
            <>
              {/* bitta stacked bar — COGS tarkibi */}
              <div className="mb-1 flex h-4 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                {items.map((it) => <div key={it.key} title={`${it.label}: ${fmt(it.v)}`} style={{ width: `${(it.v / cogs) * 100}%`, background: it.hue }} />)}
              </div>
              <p className="mb-4 text-[11.5px]" style={{ color: "var(--muted)" }}>Tannarx tarkibi (COGS): {fmt(breakdown.cogsServer)}<Tip text="Backend flower_cost + material_cost + florist_fee_cost === cost_total ni aniq kafolatlaydi." /></p>
              <div className="flex flex-col gap-1.5">
                {items.map((it) => (
                  <div key={it.key} className="flex items-center justify-between gap-3 rounded-[11px] px-3 py-2" style={{ background: "var(--surface-2)" }}>
                    <span className="flex items-center gap-2 text-[13px] font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: it.hue }} />{it.label}<Tip text={it.tip} /></span>
                    <span className="text-[13px]"><Money v={it.v} /> <span className="text-[11px]" style={{ color: "var(--muted)" }}>· {Math.round((it.v / (breakdown.salesTotal || 1)) * 100)}%</span></span>
                  </div>
                ))}
                {/* §6: filial rejimida chiqit STRUKTURAVIY BO'SH (filiallarda gul saqlanmaydi) */}
                {branchMode === "branch" ? (
                  <div className="rounded-[12px] border border-dashed px-3 py-3 text-center" style={{ borderColor: "var(--border)" }}>
                    <p className="text-[12.5px] font-bold">Filiallarda gul saqlanmaydi</p>
                    <p className="mt-0.5 text-[11.5px]" style={{ color: "var(--muted)" }}>Chiqit faqat asosiy filialda hisoblanadi — bu yerda ko&apos;rsatiladigan chiqit yo&apos;q.</p>
                  </div>
                ) : (<>
                {/* CHIQIT — alohida, ko'zga tashlangan (real xarajat drayveri) + kengaytiriladi */}
                <div className="rounded-[11px] border-[1.5px] px-3 py-2" style={{ borderColor: "var(--danger-ink)", background: "color-mix(in srgb, var(--danger-ink) 7%, transparent)" }}>
                  <button onClick={() => setWasteOpen(!wasteOpen)} className="flex w-full items-center justify-between gap-3 text-left">
                    <span className="flex items-center gap-2 text-[13px] font-bold" style={{ color: "var(--danger-ink)" }}><TrendingDown size={15} strokeWidth={2.2} /> Chiqit yo&apos;qotishi<Tip text="Server cost_value yig'indisi (chiqit harakatlari). COGS'ga kirmaydi — alohida yo'qotish. ZZZ_TEST_ partiyalar chiqarilgan." /></span>
                    <span className="flex flex-col items-end text-[13px] font-bold" style={{ color: "var(--danger-ink)" }}>
                      <span className="flex items-center gap-2"><Money v={breakdown.waste} tone="var(--danger-ink)" bold /> · {breakdown.wasteStems} dona <ChevronRight size={14} className={`transition-transform ${wasteOpen ? "rotate-90" : ""}`} /></span>
                      {breakdown.wasteSale > 0 && <span className="text-[11px] font-semibold" style={{ color: "var(--danger-ink)", opacity: 0.8 }}>daromadda {fmt(breakdown.wasteSale)} yo&apos;qoldi</span>}
                    </span>
                  </button>
                  {wasteOpen && (
                    <div className="mt-2 flex flex-col gap-1 border-t pt-2" style={{ borderColor: "color-mix(in srgb, var(--danger-ink) 20%, transparent)" }}>
                      {cleanWaste.length === 0 && <p className="text-[12px]" style={{ color: "var(--muted)" }}>Bu davrda chiqit yo&apos;q.</p>}
                      {cleanWaste.map((m) => (
                        <div key={m.id} className="flex items-center justify-between gap-2 text-[12.5px]">
                          <span className="min-w-0 truncate">№{m.batch_detail?.batch_number} · {m.batch_detail?.variant_detail?.flower_detail?.name_uz} {m.batch_detail?.variant_detail?.name_uz}{m.reason ? ` — ${m.reason}` : ""}</span>
                          <span className="shrink-0 tabular-nums" style={{ color: "var(--danger-ink)" }}>{Math.abs(m.quantity_stems)} dona · {fmt(m.cost_value)}{num(m.sale_value) > 0 ? <span style={{ opacity: 0.7 }}> · sotuvda {fmt(m.sale_value)}</span> : null}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* FLORIST QO'LIDAGI CHIQIT — sklad chiqiti bilan JAMLANMAGAN (ataylab) */}
                <div className="rounded-[12px] border px-3 py-2.5" style={{ borderColor: "color-mix(in srgb, var(--danger-ink) 25%, var(--border))" }}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 text-[13px] font-bold" style={{ color: "var(--danger-ink)" }}><Trash2 size={14} strokeWidth={2.2} /> Florist qo&apos;lidagi chiqit<Tip text="Floristga chiqarilgan, keyin uning qo'lida yo'qolgan gullar. Sklad chiqitidan alohida hisoblanadi." /></span>
                    <span className="text-[13px] font-bold tabular-nums" style={{ color: "var(--danger-ink)" }}>{fmt(floristWasteTotal.value)} · {floristWasteTotal.stems} dona</span>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold" style={{ color: "var(--muted)" }}>Sklad chiqiti bilan qo&apos;shilmagan{branchMode === "all" ? " · faqat asosiy filial" : ""}</p>
                </div>
                </>)}
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
                <th className="px-2 py-2 text-right font-semibold">Standart / Maxsus<Tip text="Yasalgan DONA soni (quantity_total) — katalog yozuvlari soni emas." /></th>
                <th className="px-2 py-2 text-right font-semibold">Ishlab chiqarish</th>
                <th className="px-2 py-2 text-right font-semibold">Oylik</th>
                <th className="px-2 py-2 text-right font-semibold">1 donaga<Tip text="Oylik / yasalgan dona soni" /></th>
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

      {/* ── 6. BRON TO'LOVLARI (zaklad — cashflow, sotuv EMAS) ── */}
      <SectionCard n={6} icon={<BookmarkCheck size={18} strokeWidth={2} />} title="Bron to'lovlari" sub="oldindan olingan zakladlar — cashflow (sotuv daromadidan alohida)" onExport={resvPays.length ? () => doExport("Bron_tolovlari", () => X.reservationSheet(reservationExport())) : undefined}>
        <p className="mb-3 flex items-start gap-1.5 rounded-[12px] px-3.5 py-2.5 text-[12px] leading-snug" style={{ background: "var(--surface-2)", color: "var(--text-2)" }}>
          <Info size={14} className="mt-px shrink-0" style={{ color: "var(--primary)" }} />
          Bu <b>zaklad</b> pullari — kirim (cashflow). Bron katalogdan sotilganda to&apos;liq sotuv narxi 2-bo&apos;limda daromad bo&apos;lib yoziladi. <b>Zakladni ikki marta sanamang</b> — u shu yerda faqat pul oqimi sifatida ko&apos;rsatiladi.
        </p>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <MiniStat label="Jami zaklad" value={fmt(resvTotals.total)} hue="var(--acc)" />
          <MiniStat label="Naqd" value={fmt(resvTotals.cash)} />
          <MiniStat label="Karta" value={fmt(resvTotals.card)} />
          <MiniStat label="O'tkazma" value={fmt(resvTotals.transfer)} />
        </div>
        {resvPays.length === 0 ? (
          <p className="mt-3 text-[13px]" style={{ color: "var(--muted)" }}>Bu davrda bron to&apos;lovi yo&apos;q.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13px]">
              <thead>
                <tr className="text-left" style={{ color: "var(--muted)" }}>
                  <th className="py-2 pr-3 font-semibold">Sana</th>
                  <th className="py-2 pr-3 font-semibold">Mijoz</th>
                  <th className="py-2 pr-3 font-semibold">So&apos;rov</th>
                  <th className="py-2 pr-3 font-semibold">Usul</th>
                  <th className="py-2 pl-3 text-right font-semibold">Summa</th>
                </tr>
              </thead>
              <tbody>
                {resvPays.map((p) => (
                  <tr key={p.id} className="border-t" style={{ borderColor: "var(--line2)" }}>
                    <td className="py-2 pr-3 tabular-nums whitespace-nowrap">{fmtDate(p.date)}</td>
                    <td className="py-2 pr-3">
                      <Link href={`/bronlar`} className="font-semibold hover:underline">{p.customer}</Link>
                    </td>
                    <td className="max-w-[220px] truncate py-2 pr-3" style={{ color: "var(--text-2)" }} title={p.request}>{p.request || "—"}</td>
                    <td className="py-2 pr-3"><span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "var(--hover)", color: "var(--text-2)" }}>{PAYMENT_METHOD_LABEL[p.method]}</span></td>
                    <td className="py-2 pl-3 text-right font-bold tabular-nums" style={{ color: "var(--acc)" }}>{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2" style={{ borderColor: "var(--border)" }}>
                  <td colSpan={4} className="py-2 pr-3 font-bold">Jami ({resvTotals.count} ta to&apos;lov)</td>
                  <td className="py-2 pl-3 text-right font-extrabold tabular-nums" style={{ color: "var(--acc)" }}>{fmt(resvTotals.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </SectionCard>

      {payDrawer && (
        <PaymentDrawer
          init={payDrawer}
          suppliers={suppliers}
          onClose={() => setPayDrawer(null)}
          onSaved={() => { setPayDrawer(null); invalidateReportCache(); refreshSuppliers(); }}
          showToast={showToast}
        />
      )}
    </div>
  );
}

/** To'lov qo'shish / tahrirlash — o'ng drawer. */
function PaymentDrawer({ init, suppliers, onClose, onSaved, showToast }: {
  init: { supplierId: number; edit?: SupplierPayment };
  suppliers: Supplier[];
  onClose: () => void;
  onSaved: () => void;
  showToast: (m: string) => void;
}) {
  const e = init.edit;
  const [supplier, setSupplier] = useState<number>(e?.supplier ?? init.supplierId);
  const [amount, setAmount] = useState<string>(e ? String(Math.round(num(e.amount))) : "");
  const [paidAt, setPaidAt] = useState<string>(e?.paid_at ?? ymd(new Date()));
  const [method, setMethod] = useState<SupplierPaymentMethod>(e?.method ?? "cash");
  const [note, setNote] = useState<string>(e?.note ?? "");
  const [busy, setBusy] = useState(false);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const save = async () => {
    if (!(+amount > 0)) { setErrs({ amount: "To'lov summasi noldan katta bo'lishi kerak." }); return; }
    if (!supplier) { setErrs({ supplier: "Yetkazib beruvchini tanlang." }); return; }
    setBusy(true); setErrs({});
    try {
      const body = { supplier, amount: String(+amount), paid_at: paidAt, method, note };
      if (e) await api.updateSupplierPayment(e.id, body);
      else await api.createSupplierPayment(body);
      showToast(e ? "✓ To'lov yangilandi" : "✓ To'lov qo'shildi");
      onSaved();
    } catch (err) {
      if (err instanceof ApiError && err.fieldErrors) setErrs(err.fieldErrors);
      showToast(err instanceof ApiError ? err.message : "Saqlab bo'lmadi");
      setBusy(false);
    }
  };

  return (
    <Drawer onClose={onClose} width={440} title={e ? "To'lovni tahrirlash" : "To'lov qo'shish"} sub="yetkazib beruvchiga to'lov">
      <div className="flex flex-col gap-3.5">
        <Field label="Yetkazib beruvchi">
          <Select value={supplier} onChange={(v) => setSupplier(+v)} placeholder="Tanlang" searchable
            options={suppliers.map((s) => ({ value: s.id, label: s.name, hint: s.outstanding && +s.outstanding > 0 ? `qarz ${fmt(s.outstanding)}` : undefined }))} />
          {errs.supplier && <p className="mt-1 text-[12px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.supplier}</p>}
        </Field>
        <Field label="Summa (so'm)">
          <input className="inp" inputMode="numeric" value={amount} onChange={(ev) => { setAmount(ev.target.value.replace(/\D/g, "")); setErrs((x) => ({ ...x, amount: "" })); }} placeholder="Masalan: 5000000" autoFocus />
          {errs.amount && <p className="mt-1 text-[12px] font-semibold" style={{ color: "var(--danger-ink)" }}>{errs.amount}</p>}
        </Field>
        <Field label="To'lov sanasi">
          <DatePicker value={paidAt} onChange={setPaidAt} ariaLabel="To'lov sanasi" />
        </Field>
        <Field label="To'lov turi">
          <div className="flex gap-1 rounded-[12px] p-1" style={{ background: "var(--surface-2)" }}>
            {METHOD_OPTS.map((m) => (
              <button key={m.value} type="button" onClick={() => setMethod(m.value)} className="flex-1 rounded-[9px] py-1.5 text-[13px] font-bold transition-colors" style={{ background: method === m.value ? "var(--surface-solid)" : "transparent", color: method === m.value ? "var(--primary)" : "var(--muted)" }}>{m.label}</button>
            ))}
          </div>
        </Field>
        <Field label="Izoh">
          <input className="inp" value={note} onChange={(ev) => setNote(ev.target.value)} placeholder="Ixtiyoriy" />
        </Field>
        <div className="mt-1 flex gap-2.5">
          <button onClick={onClose} className="btn-ghost flex-1">Bekor</button>
          <button onClick={save} disabled={busy} className={clsx("btn-primary flex-1", busy && "btn-loading")}>Saqlash</button>
        </div>
      </div>
    </Drawer>
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

/** Section 2 detal — kompozitsiya (gul/partiya/tannarx, ma'lumot uchun) + SERVER
    tannarx ajratmasi (flower_cost/material_cost/florist_fee_cost — sotuv bo'yicha). */
function CatalogDetail({ sale, item, net }: { sale: import("@/lib/types").AccountingSale; item?: CatalogItem; net: number }) {
  const qty = sale.quantity;
  // §5 SOTUVDA QO'SHILGAN — shu sotuv history snapshot'idan (material_cost ichida allaqachon hisobga olingan → tannarx reconcile qiladi)
  const snap = item?.history?.find((h) => h.id === sale.history_id)?.snapshot;
  const saleMats = snap?.sale_materials?.filter(Boolean) ?? [];
  const saleDeco = snap?.sale_decoration;
  return (
    <div className="px-3 py-3">
      {item ? (
        <>
          <div className="mb-1.5 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Tarkib (1 dona)</div>
          <div className="flex flex-col gap-1">
            {item.composition.map((c) => {
              const free = !!c.batch_detail?.is_free;
              return (
              <div key={c.id} className="flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px]" style={{ background: "var(--surface-2)" }}>
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="min-w-0 truncate">{c.batch_detail?.variant_detail?.flower_detail?.name_uz} {c.batch_detail?.variant_detail?.name_uz} · №{c.batch_detail?.batch_number}</span>
                  {free && <FreeBatchChip />}
                </span>
                <span className="shrink-0 tabular-nums" style={{ color: free ? "var(--acc)" : "var(--text-2)" }}>{c.quantity_stems} dona × {free ? "0 · tekin" : `${fmt(c.batch_detail?.cost_per_stem)}/dona`}</span>
              </div>
              );
            })}
            {(item.materials ?? []).map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px]" style={{ background: "var(--surface-2)" }}>
                <span className="min-w-0 truncate">Material: {m.packaging_detail?.name_uz}</span>
                <span className="shrink-0 tabular-nums" style={{ color: "var(--text-2)" }}>{m.quantity} × {fmt(m.packaging_detail?.cost_price)}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>Kompozitsiya mavjud emas (katalog yozuvi o&apos;chirilgan) — tannarx ajratmasi serverdan.</p>
      )}
      {/* §5 SOTUVDA QO'SHILGAN — qo'shimcha material va bezovchi florist (snapshot); tannarxi material_cost'ga kirgan */}
      {(saleMats.length > 0 || saleDeco) && (
        <div className="mt-2 rounded-[10px] border-t pt-2" style={{ borderColor: "var(--line2)" }}>
          <div className="mb-1 text-[11px] font-bold uppercase tracking-wider" style={{ color: "var(--acc)" }}>Sotuvda qo&apos;shilgan</div>
          <div className="flex flex-col gap-1">
            {saleMats.map((m, mi) => (
              <div key={mi} className="flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px]" style={{ background: "var(--surface-2)" }}>
                <span className="min-w-0 truncate">📦 {m.material ?? m.type ?? "Material"}{m.quantity != null ? ` · ${m.quantity} dona` : ""}</span>
                {(m.cost != null || m.unit_cost != null) && <span className="shrink-0 tabular-nums" style={{ color: "var(--text-2)" }}>{fmt(m.cost ?? m.unit_cost ?? 0)}</span>}
              </div>
            ))}
            {saleDeco && (
              <div className="flex items-center justify-between gap-2 rounded-[10px] px-2.5 py-1.5 text-[12.5px]" style={{ background: "var(--surface-2)" }}>
                <span className="min-w-0 truncate">✨ Oformleniya (sotuvda): {saleDeco.florist_name ?? `#${saleDeco.florist ?? "?"}`}</span>
                {(saleDeco.amount != null || saleDeco.fee != null) && <span className="shrink-0 tabular-nums" style={{ color: "var(--acc)" }}>{fmt(saleDeco.amount ?? saleDeco.fee ?? 0)}</span>}
              </div>
            )}
          </div>
        </div>
      )}
      {/* ⚠️ TEKIN GUL — marja «g'ayritabiiy» ko'rinadi va bu HAQIQIY. Raqam o'zgartirilmaydi, sabab aytiladi. */}
      {(item?.composition ?? []).some((c) => c.batch_detail?.is_free) && (
        <p className="mt-2 flex items-start gap-1.5 rounded-[10px] px-2.5 py-1.5 text-[11.5px] font-semibold" style={{ background: "color-mix(in srgb, var(--acc) 12%, transparent)", color: "var(--acc)" }}>
          <Info size={12} className="mt-px shrink-0" /> Tarkibida <b>tekin gul</b> bor — uning tannarxi 0, shuning uchun bu sotuvning marjasi yuqori ko&apos;rinadi. Raqam to&apos;g&apos;ri.
        </p>
      )}
      {/* SERVER tannarx ajratmasi (butun sotuv bo'yicha, × {qty}). flower+material+fee === cost_total (kafolat). */}
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 border-t pt-2 text-[12.5px]" style={{ borderColor: "var(--line2)" }}>
        <span>Gullar: <b>{fmt(sale.flower_cost)}</b></span>
        <span>Materiallar: <b>{fmt(sale.material_cost)}</b></span>
        <span>Florist haqi: <b>{fmt(sale.florist_fee_cost)}</b></span>
        <span>Tannarx: <b>{fmt(sale.cost_total)}</b><Tip text="Server: flower_cost + material_cost + florist_fee_cost === cost_total (aniq)." /></span>
        <span>Sof foyda: <b style={{ color: profitTone(net, num(sale.sale_total) ? (net / num(sale.sale_total)) * 100 : 0) }}>{fmt(net)}</b></span>
      </div>
    </div>
  );
}
