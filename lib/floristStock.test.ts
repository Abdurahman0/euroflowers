import { describe, it, expect } from "vitest";
import { balanceRemaining, batchHeldByFlorist, stemsForBatch, isBatchOverBalance, type CompStemRow } from "./floristStock";
import type { FloristStockBalance, FloristStockIssue } from "./types";

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

// ── FU2: florist-balance composition validation (the over-balance logic)
const bal = [{ batch: 51, remaining_stems: 20 }, { batch: 52, remaining_stems: 12 }];

describe("FU2 — over-balance validation", () => {
  it("single row over the balance → over", () => {
    const rows: CompStemRow[] = [{ stock_batch: 51, stems: 25 }];
    expect(isBatchOverBalance(rows, bal, 51)).toBe(true);
  });
  it("TWO rows on the same batch jointly over the balance → over (sum case)", () => {
    const rows: CompStemRow[] = [{ stock_batch: 51, stems: 12 }, { stock_batch: 51, stems: 10 }];
    expect(stemsForBatch(rows, 51)).toBe(22);
    expect(isBatchOverBalance(rows, bal, 51)).toBe(true);
  });
  it("two rows on the same batch within the balance → NOT over", () => {
    const rows: CompStemRow[] = [{ stock_batch: 51, stems: 8 }, { stock_batch: 51, stems: 10 }];
    expect(isBatchOverBalance(rows, bal, 51)).toBe(false);
  });
  it("exactly at the balance → valid (not over)", () => {
    const rows: CompStemRow[] = [{ stock_batch: 51, stems: 20 }];
    expect(isBatchOverBalance(rows, bal, 51)).toBe(false);
  });
  it("balance lookup falls back to 0 for an unheld batch", () => {
    expect(balanceRemaining(bal, 99)).toBe(0);
  });
});

describe("FU2 — re-validation after switching florist", () => {
  const floristA = [{ batch: 51, remaining_stems: 20 }];
  const floristB = [{ batch: 77, remaining_stems: 5 }]; // holds a different batch
  it("a row on batch 51 is valid for florist A but invalid after switching to florist B", () => {
    expect(batchHeldByFlorist(floristA, 51)).toBe(true);
    expect(batchHeldByFlorist(floristB, 51)).toBe(false); // florist B doesn't hold it → invalid row, never silently dropped
  });
  it("an unheld batch is 'invalid', not 'over' (0 remaining, but flagged as not-held)", () => {
    const rows: CompStemRow[] = [{ stock_batch: 51, stems: 5 }];
    expect(isBatchOverBalance(rows, floristB, 51)).toBe(false); // not counted as over — it's the invalid path
    expect(batchHeldByFlorist(floristB, 51)).toBe(false);
  });
});
