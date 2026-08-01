import { describe, it, expect, vi } from "vitest";
import {
  num, allocateByCost, reconcile, saleProfit, profitTone,
  wasteTotals, costBreakdown, saleLineAllocations, isTestRecord, excludeTest,
} from "./finance";
import type { AccountingSale, CatalogItem, StockMovement } from "./types";

// jonli "mm" (catalog_id=49) buyumiga mos fixture — Part D bilan bir xil raqamlar
const item49 = {
  id: 49, quantity_total: 5, florist_fee: "10000",
  composition: [{ id: 1, stock_batch: 40, quantity_stems: 25, quantity_bunches: "1",
    batch_detail: { id: 40, cost_per_stem: "35000", variant: 23, supplier: 7, variant_detail: { id: 23 } } }],
  materials: [],
} as unknown as CatalogItem;

const sale49 = {
  history_id: 25, catalog_id: 49, quantity: 1,
  sale_total: "1500000", cost_total: "885000", net_profit: "615000", discount_amount: "100000",
  // server tannarx ajratmasi (0082): flower+material+fee === cost_total
  flower_cost: "875000", material_cost: "0", florist_fee_cost: "10000",
} as unknown as AccountingSale;

describe("test-record guard", () => {
  it("isTestRecord matches only the ZZZ_TEST_ prefix", () => {
    expect(isTestRecord("ZZZ_TEST_LIVE_1")).toBe(true);
    expect(isTestRecord("ZZZ_TEST_DONA_A")).toBe(true);
    expect(isTestRecord("EF-260725-23")).toBe(false);
    expect(isTestRecord("mm")).toBe(false);
    expect(isTestRecord("")).toBe(false);
    expect(isTestRecord(null)).toBe(false);
    expect(isTestRecord(undefined)).toBe(false);
  });
  it("excludeTest drops test rows by default and keeps them when include=true", () => {
    const batches = [{ batch_number: "EF-1" }, { batch_number: "ZZZ_TEST_LIVE_1" }, { batch_number: "EF-2" }];
    const clean = excludeTest(batches, (b) => b.batch_number);
    expect(clean).toHaveLength(2);
    expect(clean.map((b) => b.batch_number)).toEqual(["EF-1", "EF-2"]);
    expect(excludeTest(batches, (b) => b.batch_number, true)).toHaveLength(3);
  });
  it("filters waste movements by their batch_number (not by reason)", () => {
    // reason 'ZZZ bunch' lacks the prefix, but the batch is ZZZ_TEST_ → excluded
    const waste = [
      { reason: "ZZZ bunch", batch_detail: { batch_number: "ZZZ_TEST_DONA_A" } },
      { reason: "buzilgan", batch_detail: { batch_number: "EF-9" } },
    ];
    const clean = excludeTest(waste, (m) => m.batch_detail?.batch_number);
    expect(clean).toHaveLength(1);
    expect(clean[0].batch_detail.batch_number).toBe("EF-9");
  });
});

describe("num", () => {
  it("parses decimal strings and guards junk", () => {
    expect(num("885000.00")).toBe(885000);
    expect(num(1500000)).toBe(1500000);
    expect(num(null)).toBe(0);
    expect(num(undefined)).toBe(0);
    expect(num("")).toBe(0);
    expect(num("abc")).toBe(0);
  });
});

describe("allocateByCost", () => {
  it("splits purely by cost share", () => {
    const r = allocateByCost([{ cost: 750, stems: 30 }, { cost: 250, stems: 5 }], 1000);
    expect(r[0].alloc).toBeCloseTo(750);
    expect(r[1].alloc).toBeCloseTo(250);
    expect(r.every((x) => !x.fellBack)).toBe(true);
  });
  it("falls back to stem-share for a zero-cost line and flags it", () => {
    // withCost: cost800/stems20 → avgCps=40; zero-cost line stems10 → weight 400
    const r = allocateByCost([{ cost: 800, stems: 20 }, { cost: 0, stems: 10 }], 1000);
    expect(r[0].fellBack).toBe(false);
    expect(r[1].fellBack).toBe(true);
    expect(r[0].alloc + r[1].alloc).toBeCloseTo(1000);
    expect(r[0].alloc).toBeCloseTo(1000 * 800 / 1200);
    expect(r[1].alloc).toBeCloseTo(1000 * 400 / 1200);
  });
  it("uses pure stem share when NO line has cost", () => {
    const r = allocateByCost([{ cost: 0, stems: 3 }, { cost: 0, stems: 1 }], 100);
    expect(r[0].alloc).toBeCloseTo(75);
    expect(r[1].alloc).toBeCloseTo(25);
    expect(r.every((x) => x.fellBack)).toBe(true);
  });
  it("returns [] for no lines", () => {
    expect(allocateByCost([], 1000)).toEqual([]);
  });
});

describe("reconcile", () => {
  it("returns server value and no divergence within tolerance", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = reconcile(615000, 615000, "x");
    expect(r.value).toBe(615000);
    expect(r.diverged).toBe(false);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
  it("flags divergence and warns, still returns SERVER value", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = reconcile(615000, 620000, "sale");
    expect(r.value).toBe(615000); // server-wins
    expect(r.diverged).toBe(true);
    expect(r.delta).toBe(5000);
    expect(spy).toHaveBeenCalledOnce();
    spy.mockRestore();
  });
});

describe("saleProfit", () => {
  it("uses server net_profit and computes margin (reconciles to live 'mm')", () => {
    const p = saleProfit(sale49);
    expect(p.sale).toBe(1500000);
    expect(p.cost).toBe(885000);
    expect(p.net).toBe(615000);       // SERVER
    expect(p.netClient).toBe(615000); // 1500000 - 885000
    expect(p.diverged).toBe(false);
    expect(p.margin).toBeCloseTo(41.0, 1);
    expect(p.discount).toBe(100000);
  });
  it("prefers server value and flags when server disagrees with sale-cost", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const p = saleProfit({ sale_total: "1000", cost_total: "600", net_profit: "300", discount_amount: "0" });
    expect(p.net).toBe(300);     // server-wins even though 1000-600=400
    expect(p.netClient).toBe(400);
    expect(p.diverged).toBe(true);
    spy.mockRestore();
  });
});

describe("profitTone", () => {
  it("maps health to tokens", () => {
    expect(profitTone(-5, 10)).toBe("var(--danger-ink)");
    expect(profitTone(100, 8)).toBe("var(--warning-ink)");
    expect(profitTone(100, 40)).toBe("var(--success-ink)");
  });
});

describe("wasteTotals", () => {
  it("sums the SERVER cost_value and sale_value (no client cost_per_stem math)", () => {
    const mv = [
      { quantity_stems: -25, cost_value: "250000", sale_value: "375000" },
      { quantity_stems: -10, cost_value: "100000", sale_value: "150000" },
    ] as unknown as StockMovement[];
    const w = wasteTotals(mv);
    expect(w.stems).toBe(35);
    expect(w.cost).toBe(350000);
    expect(w.sale).toBe(525000); // "qancha daromad yo'qoldi"
  });
});

describe("costBreakdown", () => {
  it("uses SERVER per-sale split (flower/material/fee) + server waste values", () => {
    const waste = [{ quantity_stems: -25, cost_value: "250000", sale_value: "375000" }] as unknown as StockMovement[];
    const b = costBreakdown([sale49], waste, 100000);
    expect(b.flower).toBe(875000);   // server flower_cost
    expect(b.material).toBe(0);
    expect(b.fee).toBe(10000);
    expect(b.flower + b.material + b.fee).toBe(b.cogsServer); // backend guarantees === cost_total
    expect(b.cogsServer).toBe(885000);
    expect(b.waste).toBe(250000);
    expect(b.wasteSale).toBe(375000);
    expect(b.discounts).toBe(100000);
    expect(b.salesTotal).toBe(1500000);
    expect(b.netProfit).toBe(615000);
  });
});

describe("saleLineAllocations", () => {
  it("allocates full sale revenue across composition lines by cost share", () => {
    const lines = saleLineAllocations(sale49, item49);
    expect(lines).toHaveLength(1);
    expect(lines[0].batch).toBe(40);
    expect(lines[0].supplierId).toBe(7);
    expect(lines[0].variantId).toBe(23);
    expect(lines[0].stems).toBe(25);         // 25 × qty 1
    expect(lines[0].cost).toBe(875000);
    expect(lines[0].revenue).toBeCloseTo(1500000); // single line → whole sale
    expect(lines[0].fellBack).toBe(false);
  });
  it("returns [] when the catalog item is unknown", () => {
    expect(saleLineAllocations(sale49, undefined)).toEqual([]);
  });

  // ⚠️ GUARD: cost derivations MUST read the ROUNDED cost_per_stem, NEVER cost_per_stem_exact.
  // If a future refactor swaps to the exact field, this fails loudly (100×1000 → 100×998).
  it("uses the ROUNDED cost_per_stem, not cost_per_stem_exact (display-only)", () => {
    const itemRounded = {
      id: 1, name_uz: "R", quantity_total: 1,
      composition: [{ id: 1, stock_batch: 40, quantity_stems: 100, quantity_bunches: "4",
        batch_detail: { id: 40, cost_per_stem: "1000", cost_per_stem_exact: "998.0000", variant: 23, supplier: 7, variant_detail: { id: 23 } } }],
      materials: [],
    } as unknown as CatalogItem;
    const s = { catalog_id: 1, sale_total: "200000", cost_total: "100000", net_profit: "100000", quantity: 1, discount_amount: "0" } as unknown as AccountingSale;
    const lines = saleLineAllocations(s, itemRounded);
    expect(lines[0].cost).toBe(100000);   // 100 × 1000 (rounded)
    expect(lines[0].cost).not.toBe(99800); // NOT 100 × 998 (exact) — exact must never leak into cost
  });
});
