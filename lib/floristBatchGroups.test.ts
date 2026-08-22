import { describe, it, expect } from "vitest";
import { groupBatchesForIssue, allocateStems, mergeAllocations } from "./floristBatchGroups";
import type { StockBatch } from "./types";

// Floristga gul chiqarishda partiyalar guruhlanadi: postavshik + gul turi (nav) + bo'yi.
// Jonli ma'lumot (22.08.2026): «Hojiakbar · Atirgul 50 sm» — 3 ta alohida partiya edi.
const batch = (p: Partial<StockBatch> & { id: number }): StockBatch =>
  ({
    variant: 73, height_cm: 60, height_label: "60 sm", stems_per_bunch: 25,
    remaining_stems: 0, received_at: "2026-08-01", cost_per_stem: "1000",
    batch_number: `B${p.id}`, title: "Atirgul 60 sm", flower_name: "Atirgul",
    supplier_detail: { id: 1, name: "Supplier A" },
    ...p,
  } as unknown as StockBatch);

describe("FG1 — uchala maydon mos kelsa BITTA variant", () => {
  const rows = [
    batch({ id: 1, remaining_stems: 50, received_at: "2026-08-01" }),
    batch({ id: 2, remaining_stems: 30, received_at: "2026-08-02" }),
    batch({ id: 3, remaining_stems: 20, received_at: "2026-08-03" }),
  ];

  it("uchta partiya → bitta guruh, qoldiqlar qo'shiladi", () => {
    const gs = groupBatchesForIssue(rows);
    expect(gs).toHaveLength(1);
    expect(gs[0].remainingStems).toBe(100);
    expect(gs[0].items.map((b) => b.id)).toEqual([1, 2, 3]);
  });

  it("qoldig'i tugagan partiya guruhga KIRMAYDI", () => {
    const gs = groupBatchesForIssue([...rows, batch({ id: 9, remaining_stems: 0 })]);
    expect(gs[0].items.map((b) => b.id)).toEqual([1, 2, 3]);
    expect(gs[0].remainingStems).toBe(100);
  });
});

describe("FG2 — biror maydon farq qilsa ALOHIDA qoladi", () => {
  it("bo'yi boshqa → alohida", () => {
    const gs = groupBatchesForIssue([
      batch({ id: 1, remaining_stems: 10, height_cm: 60 }),
      batch({ id: 2, remaining_stems: 10, height_cm: 70, height_label: "70 sm", title: "Atirgul 70 sm" }),
    ]);
    expect(gs).toHaveLength(2);
  });

  it("postavshik boshqa → alohida", () => {
    const gs = groupBatchesForIssue([
      batch({ id: 1, remaining_stems: 10, supplier: 1 } as never),
      batch({ id: 2, remaining_stems: 10, supplier: 2, supplier_detail: { id: 2, name: "Supplier B" } } as never),
    ]);
    expect(gs).toHaveLength(2);
  });

  it("nav (gul turi) boshqa → alohida", () => {
    const gs = groupBatchesForIssue([
      batch({ id: 1, remaining_stems: 10, variant: 73 }),
      batch({ id: 2, remaining_stems: 10, variant: 31 }),
    ]);
    expect(gs).toHaveLength(2);
  });
});

describe("FG3 — pochka hisobi faqat bir xil bo'lsa", () => {
  it("stems_per_bunch bir xil → pochka bilan ishlash mumkin", () => {
    expect(groupBatchesForIssue([
      batch({ id: 1, remaining_stems: 25, stems_per_bunch: 25 }),
      batch({ id: 2, remaining_stems: 25, stems_per_bunch: 25 }),
    ])[0].stemsPerBunch).toBe(25);
  });

  it("har xil bo'lsa null — pochka ikki ma'noli bo'lardi", () => {
    expect(groupBatchesForIssue([
      batch({ id: 1, remaining_stems: 25, stems_per_bunch: 25 }),
      batch({ id: 2, remaining_stems: 20, stems_per_bunch: 20 }),
    ])[0].stemsPerBunch).toBeNull();
  });
});

describe("FG4 — taqsimot FIFO (eski partiyadan boshlab)", () => {
  const items = [
    batch({ id: 1, remaining_stems: 50, received_at: "2026-08-01" }),
    batch({ id: 2, remaining_stems: 30, received_at: "2026-08-02" }),
    batch({ id: 3, remaining_stems: 20, received_at: "2026-08-03" }),
  ];

  it("70 dona → 50 + 20 (uchinchisiga tegilmaydi)", () => {
    expect(allocateStems(items, 70)).toEqual([
      { batch: 1, quantity_stems: 50 },
      { batch: 2, quantity_stems: 20 },
    ]);
  });

  it("bitta partiyaga sig'sa faqat o'sha ishlatiladi", () => {
    expect(allocateStems(items, 40)).toEqual([{ batch: 1, quantity_stems: 40 }]);
  });

  it("hech bir qatorda partiya qoldig'idan OSHMAYDI", () => {
    for (const r of allocateStems(items, 100)) {
      const b = items.find((x) => x.id === r.batch)!;
      expect(r.quantity_stems).toBeLessThanOrEqual(b.remaining_stems);
    }
    expect(allocateStems(items, 100).reduce((s, r) => s + r.quantity_stems, 0)).toBe(100);
  });

  it("qoldiqdan ko'p so'ralsa — bori taqsimlanadi (chaqiruvchi oldindan to'sadi)", () => {
    expect(allocateStems(items, 500).reduce((s, r) => s + r.quantity_stems, 0)).toBe(100);
  });

  it("sana teng bo'lsa kichik id oldin ketadi", () => {
    const same = [batch({ id: 7, remaining_stems: 5, received_at: "2026-08-01" }), batch({ id: 4, remaining_stems: 5, received_at: "2026-08-01" })];
    expect(allocateStems(same, 5)).toEqual([{ batch: 4, quantity_stems: 5 }]);
  });
});

describe("FG5 — bitta partiyaga tushgan qatorlar jamlanadi", () => {
  it("takroriy batch bitta qatorga qo'shiladi", () => {
    expect(mergeAllocations([
      { batch: 1, quantity_stems: 10 },
      { batch: 2, quantity_stems: 5 },
      { batch: 1, quantity_stems: 7 },
    ])).toEqual([{ batch: 1, quantity_stems: 17 }, { batch: 2, quantity_stems: 5 }]);
  });
});
