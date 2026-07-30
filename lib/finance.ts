/**
 * MOLIYA HISOB-KITOBI — markazlashgan, sof (pure) va TESTLANGAN funksiyalar.
 * Hisob-kitob sahifasining barcha klient-tomon hisoblari shu yerda (foyda
 * xatolari qabul qilinmaydi — `finance.test.ts` qamrab oladi).
 *
 * QOIDA: backend avtoritativ raqam bergan joyda (net_profit, cost_total,
 * discount_amount) DOIM shu ishlatiladi; klient faqat tekshiradi va nomuvofiqlikda
 * `reconcile()` ogohlantiradi (server qiymati ko'rsatiladi, jimgina qarama-qarshilik yo'q).
 * Klient MUSTAQIL hisoblaydigan yagona narsalar: tannarxni gul/material/haq'ga
 * AJRATISH, chiqit qiymati, va sotuvni yetkazib beruvchi/navga TAQSIMLASH.
 */
import type { AccountingSale, CatalogItem, StockMovement } from "./types";

// ─────────────────────────────────────────────────────────────────────────
// TEST-RECORD GUARD — "ZZZ_TEST_" yozuvlar hisobotdan CHIQARIB tashlanadi
// (default). Backend soft-delete/immutable ledger tufayli test partiyalari va
// chiqit harakatlari o'chirilmaydi — shu filtr ularni ko'rinmas ravishda
// statistikani buzishdan saqlaydi. Dev-toggle bilan qayta yoqish mumkin.
// ESLATMA: nomi bo'yicha (batch_number / catalog_name) filtrlanadi — reason
// bo'yicha EMAS ("ZZZ bunch" kabi reasonlar ham ZZZ_TEST_ partiyada bo'ladi).
// ─────────────────────────────────────────────────────────────────────────
export const TEST_PREFIX = "ZZZ_TEST_";
export const isTestRecord = (name?: string | null): boolean => !!name && name.startsWith(TEST_PREFIX);
/** Test yozuvlarni olib tashlaydi (default). `include=true` — dev-toggle bilan qoldiradi. */
export function excludeTest<T>(rows: T[], nameOf: (r: T) => string | null | undefined, include = false): T[] {
  return include ? rows : rows.filter((r) => !isTestRecord(nameOf(r)));
}

/** decimal-string yoki number → number (xavfsiz). */
export const num = (v: string | number | null | undefined): number => {
  if (v == null) return 0;
  const n = typeof v === "string" ? parseFloat(v) : v;
  return Number.isFinite(n) ? n : 0;
};

// ─────────────────────────────────────────────────────────────────────────
// RECONCILE — server-wins + divergence signal
// ─────────────────────────────────────────────────────────────────────────
export type Reconciled = { value: number; client: number; diverged: boolean; delta: number };

/** Server qiymatini QAYTARADI; klient bilan farq `tol`dan katta bo'lsa ogohlantiradi. */
export function reconcile(server: number, client: number, label: string, tol = 1): Reconciled {
  const delta = Math.abs(server - client);
  const diverged = delta > tol;
  if (diverged && typeof console !== "undefined") {
    // eslint-disable-next-line no-console
    console.warn(`[finance] ${label}: server=${server} client=${client} Δ=${delta.toFixed(2)}`);
  }
  return { value: server, client, diverged, delta };
}

// ─────────────────────────────────────────────────────────────────────────
// COST-SHARE ALLOCATION — sotuv summasini qatorlarga tannarx ulushi bo'yicha
// ─────────────────────────────────────────────────────────────────────────
export type AllocInput = { cost: number; stems: number };
export type AllocResult = { alloc: number; fellBack: boolean };

/**
 * `total`ni qatorlarga TANNARX ulushi bo'yicha taqsimlaydi. Tannarxi yo'q (0)
 * qatorlar uchun — SHU QATOR bo'yicha dona (stems) ulushiga qaytadi (o'rtacha
 * dona-narxi orqali baholanadi) va `fellBack:true` bilan belgilanadi.
 * Hech bir qatorda tannarx bo'lmasa — toza dona ulushi.
 */
export function allocateByCost(lines: AllocInput[], total: number): AllocResult[] {
  const n = lines.length;
  if (n === 0) return [];
  const withCost = lines.filter((l) => l.cost > 0);
  const sumCost = withCost.reduce((s, l) => s + l.cost, 0);
  const sumStems = withCost.reduce((s, l) => s + l.stems, 0);
  const avgCps = sumStems > 0 ? sumCost / sumStems : 0; // o'rtacha dona-narxi (baholash uchun)
  const eff = lines.map((l) => {
    if (l.cost > 0) return { w: l.cost, fellBack: false };
    return { w: avgCps > 0 ? l.stems * avgCps : l.stems, fellBack: true };
  });
  const totalW = eff.reduce((s, e) => s + e.w, 0);
  return eff.map((e) => ({ alloc: totalW > 0 ? total * (e.w / totalW) : total / n, fellBack: e.fellBack }));
}

// ─────────────────────────────────────────────────────────────────────────
// PER-SALE PROFIT — server avtoritativ, klient tekshiradi
// ─────────────────────────────────────────────────────────────────────────
export type SaleProfit = { sale: number; cost: number; net: number; netClient: number; discount: number; margin: number; diverged: boolean };

export function saleProfit(s: Pick<AccountingSale, "sale_total" | "cost_total" | "net_profit" | "discount_amount">): SaleProfit {
  const sale = num(s.sale_total);
  const cost = num(s.cost_total);
  const net = num(s.net_profit);                 // SERVER avtoritativ
  const netClient = sale - cost;
  const rec = reconcile(net, netClient, "sale net_profit");
  return { sale, cost, net, netClient, discount: num(s.discount_amount), margin: sale > 0 ? (net / sale) * 100 : 0, diverged: rec.diverged };
}

/** foyda salomatligi rangi (tema tokenlari): sog'lom / yupqa / zarar. */
export function profitTone(net: number, margin: number): string {
  if (net < 0) return "var(--danger-ink)";
  if (margin < 15) return "var(--warning-ink)";
  return "var(--success-ink)";
}

// ─────────────────────────────────────────────────────────────────────────
// UNIT COST SPLIT — bitta katalog birligi tannarxi: gul / material / florist haqi
// ─────────────────────────────────────────────────────────────────────────
export type CostSplit = { flower: number; material: number; fee: number; total: number };

/** Kompozitsiya (dona × cost_per_stem) + materiallar (soni × cost_price) + florist_fee. */
export function unitCostSplit(item: Pick<CatalogItem, "composition" | "materials" | "florist_fee">): CostSplit {
  const flower = (item.composition ?? []).reduce((t, c) => t + c.quantity_stems * num(c.batch_detail?.cost_per_stem), 0);
  const material = (item.materials ?? []).reduce((t, m) => t + m.quantity * num(m.packaging_detail?.cost_price), 0);
  const fee = num(item.florist_fee);
  return { flower, material, fee, total: flower + material + fee };
}

// ─────────────────────────────────────────────────────────────────────────
// WASTE VALUE — chiqit qiymati (partiya cost_per_stem bo'yicha)
// ─────────────────────────────────────────────────────────────────────────
export type WasteValue = { stems: number; value: number };

export function wasteValue(movements: Pick<StockMovement, "quantity_stems" | "batch_detail">[]): WasteValue {
  let stems = 0, value = 0;
  for (const m of movements) {
    const q = Math.abs(m.quantity_stems);
    stems += q;
    value += q * num(m.batch_detail?.cost_per_stem);
  }
  return { stems, value };
}

// ─────────────────────────────────────────────────────────────────────────
// PERIOD COST BREAKDOWN — pul qayerga ketdi (Section 4)
// ─────────────────────────────────────────────────────────────────────────
export type CostBreakdown = {
  flower: number; material: number; fee: number;
  cogsServer: number; clientCogs: number; diverged: boolean;
  waste: number; wasteStems: number; discounts: number;
  salesTotal: number; netProfit: number;
};

export function costBreakdown(
  sales: AccountingSale[],
  itemsById: Map<number, CatalogItem>,
  wasteMovements: Pick<StockMovement, "quantity_stems" | "batch_detail">[],
  discountTotal: number,
): CostBreakdown {
  let flower = 0, material = 0, fee = 0, cogsServer = 0, salesTotal = 0, netProfit = 0;
  for (const s of sales) {
    salesTotal += num(s.sale_total);
    cogsServer += num(s.cost_total);
    netProfit += num(s.net_profit);
    const item = itemsById.get(s.catalog_id);
    if (item) {
      const u = unitCostSplit(item);
      flower += u.flower * s.quantity;
      material += u.material * s.quantity;
      fee += u.fee * s.quantity;
    }
  }
  const clientCogs = flower + material + fee;
  const rec = reconcile(cogsServer, clientCogs, "period COGS split", 2);
  const w = wasteValue(wasteMovements);
  return { flower, material, fee, cogsServer, clientCogs, diverged: rec.diverged, waste: w.value, wasteStems: w.stems, discounts: discountTotal, salesTotal, netProfit };
}

// ─────────────────────────────────────────────────────────────────────────
// SALE → LINE ALLOCATION — sotuvni kompozitsiya qatorlariga taqsimlash
// (Section 1 yetkazib beruvchi tushumi, Section 3 nav tushumi uchun)
// ─────────────────────────────────────────────────────────────────────────
export type LineAllocation = {
  batch: number; variantId: number | null; supplierId: number | null;
  stems: number; cost: number; revenue: number; fellBack: boolean;
};

/** Bitta sotuvni uning kompozitsiya qatorlariga tannarx ulushi bo'yicha taqsimlaydi.
    `revenue` — butun sotuv summasi qatorlarga bo'lingan; `cost`/`stems` — × sotuv soni. */
export function saleLineAllocations(sale: AccountingSale, item: CatalogItem | undefined): LineAllocation[] {
  const comp = item?.composition ?? [];
  if (!comp.length) return [];
  const perUnitCost = comp.map((c) => ({ cost: c.quantity_stems * num(c.batch_detail?.cost_per_stem), stems: c.quantity_stems }));
  const alloc = allocateByCost(perUnitCost, num(sale.sale_total));
  return comp.map((c, i) => ({
    batch: c.stock_batch,
    variantId: c.batch_detail?.variant ?? c.batch_detail?.variant_detail?.id ?? null,
    supplierId: c.batch_detail?.supplier ?? null,
    stems: c.quantity_stems * sale.quantity,
    cost: perUnitCost[i].cost * sale.quantity,
    revenue: alloc[i].alloc,
    fellBack: alloc[i].fellBack,
  }));
}
