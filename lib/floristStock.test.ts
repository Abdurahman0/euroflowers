import { describe, it, expect } from "vitest";
import {
  buildAdjustRequest, canReturnToFlorist, previewBlocked, blockedBatches, unblockedBatches,
  totalUnplaced, floristRemainsAfter, formatChange,
  clampReturnStems, buildCloseIssueRequest, closeIssueBlocked, missingRateLabels, allReturns,
} from "./floristStock";
import type { AdjustPreview, CloseIssuePreview, FloristStockBalance, FloristStockIssue } from "./types";

// ── FU1: the exact payloads used in the Stage 2 screenshots, now TYPED. If a
//    fixture I invented doesn't satisfy the documented shape, this file won't compile.
const balance: FloristStockBalance = {
  id: 1, florist: 4, florist_name: "Abror", batch: 51, remaining_stems: 20,
  batch_detail: { id: 51, batch_number: "EF-260725-23", flower: "Atirgul", variant: "Freedom", color: "Qizil", height_label: "50 sm", image_url: "", cost_per_stem: "8000.00", stems_per_bunch: 25 },
  created_at: "2026-07-31T10:00:00+05:00", updated_at: "2026-07-31T10:00:00+05:00",
};
const issue: FloristStockIssue = {
  id: 12, florist: 4, florist_name: "Abror", batch: 51,
  batch_detail: { id: 51, batch_number: "EF-260725-23", flower: "Atirgul", variant: "Freedom", color: "Qizil", height_label: "50 sm", image_url: "", cost_per_stem: "8000.00", stems_per_bunch: 25 },
  kind: "issue", kind_label: "Chiqarildi", quantity_stems: 30, reason: "Ertangi buketlar uchun",
  created_at: "2026-07-31T09:00:00+05:00", updated_at: "2026-07-31T09:00:00+05:00",
};

describe("FU1 — screenshot fixtures satisfy the live types", () => {
  it("balance/issue fixtures are structurally valid", () => {
    expect(balance.batch_detail.stems_per_bunch).toBe(25);
    expect(issue.kind).toBe("issue");
  });
});

// NOTE: FU2 (florist-balance composition over-balance validation) was removed with the
// florist-mode composition feature — florist catalogs no longer pick flowers; the
// close-issue flow distributes them. balanceRemaining/stemsForBatch/isBatchOverBalance/
// batchHeldByFlorist were deleted from lib/floristStock.ts (adjust never used them).

// ── FA1: adjust preview-request builder — the endpoint's required-field rules
describe("FA1 — buildAdjustRequest required-field rules", () => {
  it("to_catalog per-florist: batch omitted, quantity_stems NEVER sent", () => {
    const r = buildAdjustRequest({ florist: 4, direction: "to_catalog", batch: null });
    expect(r).toEqual({ ok: true, req: { florist: 4, direction: "to_catalog" } });
    // even if a stray quantity is passed, to_catalog must not forward it
    const r2 = buildAdjustRequest({ florist: 4, direction: "to_catalog", batch: null, quantityStems: 9 });
    expect(r2.ok && r2.req).toEqual({ florist: 4, direction: "to_catalog" });
    expect(r2.ok && "quantity_stems" in r2.req).toBe(false);
  });
  it("to_catalog scoped to a batch: batch included, still no quantity_stems", () => {
    const r = buildAdjustRequest({ florist: 4, direction: "to_catalog", batch: 63 });
    expect(r).toEqual({ ok: true, req: { florist: 4, direction: "to_catalog", batch: 63 } });
  });
  it("to_florist REQUIRES a batch — missing → not ok, with reason (no server round-trip)", () => {
    const r = buildAdjustRequest({ florist: 4, direction: "to_florist", batch: null, quantityStems: 10 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/partiya/i);
  });
  it("to_florist REQUIRES quantity_stems — missing/zero → not ok, with reason", () => {
    expect(buildAdjustRequest({ florist: 4, direction: "to_florist", batch: 63, quantityStems: 0 }).ok).toBe(false);
    const r = buildAdjustRequest({ florist: 4, direction: "to_florist", batch: 63, quantityStems: null });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/son/i);
  });
  it("to_florist complete: batch + quantity_stems both forwarded", () => {
    const r = buildAdjustRequest({ florist: 4, direction: "to_florist", batch: 63, quantityStems: 10 });
    expect(r).toEqual({ ok: true, req: { florist: 4, direction: "to_florist", batch: 63, quantity_stems: 10 } });
  });
  it("no florist → not ok", () => {
    expect(buildAdjustRequest({ florist: 0, direction: "to_catalog" }).ok).toBe(false);
  });
  it("canReturnToFlorist: only with a specific batch (per-florist all-batches disables to_florist)", () => {
    expect(canReturnToFlorist(63)).toBe(true);
    expect(canReturnToFlorist(null)).toBe(false);
    expect(canReturnToFlorist(0)).toBe(false);
  });
});

// ── FA2: per-item vs total change formatter — the number an operator misreads
describe("FA2 — formatChange (per-item vs total, sign & tint)", () => {
  it("quantity_total = 1 → per-item and total are the SAME magnitude", () => {
    const c = formatChange(9, 9);
    expect(c.perItemLabel).toBe("+9/dona");
    expect(c.totalLabel).toBe("+9 jami");
    expect(c.sign).toBe(1);
  });
  it("quantity_total = 2 → +1/dona costs +2 total (they DIFFER)", () => {
    const c = formatChange(1, 2);
    expect(c.perItemLabel).toBe("+1/dona");
    expect(c.totalLabel).toBe("+2 jami");
    expect(c.sign).toBe(1);
  });
  it("to_florist changes are NEGATIVE — sign is decrease, minus rendered", () => {
    const c = formatChange(-4, -8); // 2 dona → -4/dona = -8 total
    expect(c.perItemLabel).toBe("-4/dona");
    expect(c.totalLabel).toBe("-8 jami");
    expect(c.sign).toBe(-1);
  });
  it("zero change → neutral sign", () => {
    expect(formatChange(0, 0).sign).toBe(0);
  });
});

// ── FA3: blocked → confirm disabled (all-or-nothing) + unplaced + footer derivation
const previewTwoBatches = (opts?: { block2?: boolean; unplaced1?: number }): AdjustPreview => ({
  florist: 4, florist_name: "Abror", direction: "to_catalog", total_florist_stems: 30,
  blocked_count: opts?.block2 ? 1 : 0,
  batches: [
    { batch_id: 63, batch_number: "QA-1", flower: "Atirgul", florist_stems_now: 25, requested_stems: 25, unplaced_stems: opts?.unplaced1 ?? 0, blocked: false, reason: "",
      items: [
        { catalog_item: 77, catalog_name: "Buket 1", quantity_total: 1, stems_per_item_now: 25, change_per_item: 9, change_total: 9, stems_per_item_after: 34 },
        { catalog_item: 78, catalog_name: "Buket 2", quantity_total: 2, stems_per_item_now: 25, change_per_item: 8, change_total: 16, stems_per_item_after: 33 },
      ] },
    { batch_id: 64, batch_number: "QA-2", flower: "Piyon", florist_stems_now: 5, requested_stems: 5, unplaced_stems: 0, blocked: !!opts?.block2, reason: opts?.block2 ? "Bu guldan yasagan katalog yo'q" : "",
      items: opts?.block2 ? [] : [{ catalog_item: 90, catalog_name: "Savat", quantity_total: 1, stems_per_item_now: 10, change_per_item: 5, change_total: 5, stems_per_item_after: 15 }] },
  ],
});

describe("FA3 — blocked/unplaced/footer from the preview", () => {
  it("no blocked batch → previewBlocked false (confirm allowed)", () => {
    expect(previewBlocked(previewTwoBatches())).toBe(false);
  });
  it("ANY blocked batch (blocked_count>0 OR batch.blocked) → previewBlocked true (confirm DISABLED, all-or-nothing)", () => {
    const p = previewTwoBatches({ block2: true });
    expect(previewBlocked(p)).toBe(true);
    // defends even if blocked_count is stale but a batch flag is set
    const p2 = { ...previewTwoBatches(), blocked_count: 0, batches: previewTwoBatches({ block2: true }).batches };
    expect(previewBlocked(p2)).toBe(true);
  });
  it("blockedBatches lists which + reason; unblockedBatches offers per-batch execution", () => {
    const p = previewTwoBatches({ block2: true });
    expect(blockedBatches(p)).toEqual([{ batchId: 64, batchNumber: "QA-2", flower: "Piyon", reason: "Bu guldan yasagan katalog yo'q" }]);
    expect(unblockedBatches(p).map((b) => b.batch_id)).toEqual([63]);
  });
  it("unplaced_stems surfaced (never hidden)", () => {
    expect(totalUnplaced(previewTwoBatches({ unplaced1: 3 }))).toBe(3);
    expect(totalUnplaced(previewTwoBatches())).toBe(0);
  });
  it("floristRemainsAfter to_catalog = leftover unplaced (0 in the clean case)", () => {
    expect(floristRemainsAfter(previewTwoBatches())).toBe(0);
    expect(floristRemainsAfter(previewTwoBatches({ unplaced1: 3 }))).toBe(3);
  });
  it("floristRemainsAfter to_florist = stems returned to the florist (Σ −change_total)", () => {
    const p: AdjustPreview = {
      florist: 4, florist_name: "Abror", direction: "to_florist", total_florist_stems: 0, blocked_count: 0,
      batches: [{ batch_id: 63, batch_number: "QA-1", flower: "Atirgul", florist_stems_now: 0, requested_stems: 10, unplaced_stems: 0, blocked: false, reason: "",
        items: [
          { catalog_item: 77, catalog_name: "Buket 1", quantity_total: 1, stems_per_item_now: 34, change_per_item: -4, change_total: -4, stems_per_item_after: 30 },
          { catalog_item: 78, catalog_name: "Buket 2", quantity_total: 2, stems_per_item_now: 33, change_per_item: -3, change_total: -6, stems_per_item_after: 30 },
        ] }],
    };
    expect(floristRemainsAfter(p)).toBe(10); // 4 + 6 returned
  });
});

// ── FC1: close-issue preview-request builder — batch required, return_stems clamped
describe("FC1 — buildCloseIssueRequest", () => {
  it("batch is REQUIRED (each flower closed separately) → not ok without it", () => {
    const r = buildCloseIssueRequest({ florist: 4, batch: null, balance: 600 });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.reason).toMatch(/partiya|gul/i);
  });
  it("no florist → not ok", () => {
    expect(buildCloseIssueRequest({ florist: 0, batch: 72, balance: 600 }).ok).toBe(false);
  });
  it("return_stems omitted when 0 (server default)", () => {
    const r = buildCloseIssueRequest({ florist: 4, batch: 72, returnStems: 0, balance: 600 });
    expect(r).toEqual({ ok: true, req: { florist: 4, batch: 72 } });
  });
  it("return_stems forwarded when > 0", () => {
    const r = buildCloseIssueRequest({ florist: 4, batch: 72, returnStems: 40, balance: 600 });
    expect(r).toEqual({ ok: true, req: { florist: 4, batch: 72, return_stems: 40 } });
  });
  it("return_stems CLAMPED to the balance (never exceeds what the florist holds)", () => {
    const r = buildCloseIssueRequest({ florist: 4, batch: 72, returnStems: 9999, balance: 600 });
    expect(r.ok && r.req.return_stems).toBe(600);
  });
});

describe("FC1b — clampReturnStems", () => {
  it("clamps to [0, balance], floors, treats junk/negatives as 0", () => {
    expect(clampReturnStems(40, 600)).toBe(40);
    expect(clampReturnStems(700, 600)).toBe(600);
    expect(clampReturnStems(-5, 600)).toBe(0);
    expect(clampReturnStems("", 600)).toBe(0);
    expect(clampReturnStems("40.9", 600)).toBe(40);
    expect(clampReturnStems(null, 600)).toBe(0);
  });
});

// ── FC2: missing_rates → blocked; all-returns; label normalization
const previewClose = (over?: Partial<CloseIssuePreview>): CloseIssuePreview => ({
  florist: 4, florist_name: "Abror", batch_id: 72, batch_number: "QA-CLOSE",
  flower: "Atirgul · Freedom · Qizil", florist_stems_now: 600, return_stems: 40,
  share_stems: 560, unplaced_stems: 0, missing_rates: [],
  items: [
    { catalog_item: 91, catalog_name: "S buket 1", arrangement_type: "bouquet", volume: "S", quantity_total: 1, standard_stems: 15, stems_per_item: 62, stems_total: 62 },
    { catalog_item: 94, catalog_name: "L savat", arrangement_type: "basket", volume: "L", quantity_total: 4, standard_stems: 40, stems_per_item: 50, stems_total: 200 },
  ],
  ...over,
});

describe("FC2 — close-issue preview flags", () => {
  it("no missing_rates → not blocked (confirm allowed)", () => {
    expect(closeIssueBlocked(previewClose())).toBe(false);
  });
  it("missing_rates non-empty → blocked (confirm DISABLED)", () => {
    expect(closeIssueBlocked(previewClose({ missing_rates: [{ arrangement_type: "Buket", volume: "XL" }] }))).toBe(true);
  });
  it("missing-rate labels normalize both object and string shapes", () => {
    expect(missingRateLabels(previewClose({ missing_rates: [{ arrangement_type: "Buket", volume: "XL" }, "Savat · XL", { label: "Quti · S" }] })))
      .toEqual(["Buket · XL", "Savat · XL", "Quti · S"]);
  });
  it("all-returns: return==balance, share 0 → calm state, not an error", () => {
    expect(allReturns(previewClose({ return_stems: 600, share_stems: 0 }))).toBe(true);
    expect(allReturns(previewClose())).toBe(false); // partial → distributes
  });
  it("per-item ≠ total when quantity_total > 1 (formatChange reused for display)", () => {
    // L savat: 50/item across 4 items = 200 total
    const c = formatChange(50, 200);
    expect(c.perItemLabel).toBe("+50/dona");
    expect(c.totalLabel).toBe("+200 jami");
  });
});
