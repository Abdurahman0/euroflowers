import { describe, it, expect } from "vitest";
import {
  catalogRemaining, catalogCountsLabel, stockAlreadyDeducted,
  itemStemsPerUnit, sourceStems, stockStems, outputStems, outputTotalStems,
  batchBalance, reworkTotals, buildReworkPayload, perUnitLabel, emptyOutput,
  type ReworkOutputDraft,
} from "./rework";
import type { CatalogItem } from "./types";

/** Jonli javob shaklidagi katalog (id=210: ikki partiyadan 25+13 = 38 dona/dona). */
const ITEM = (id: number, stems: { batch: number; n: number }[], over: Partial<CatalogItem> = {}) => ({
  id, name_uz: `Item ${id}`, quantity_total: 1, quantity_sold: 0, quantity_wasted: 0, quantity_reworked: 0,
  composition: stems.map((s, i) => ({ id: i, stock_batch: s.batch, quantity_stems: s.n })),
  profit: { unit_cost: "600000" },
  ...over,
} as unknown as CatalogItem);

const OUT = (o: Partial<ReworkOutputDraft> = {}): ReworkOutputDraft => ({ ...emptyOutput(), ...o });
const label = (id: number) => `EF-${id}`;
const cost = () => 10000;

describe("⚠️ catalogRemaining — YAGONA qoldiq manbai", () => {
  it("server `quantity_remaining` bergani AVTORITATIV", () => {
    expect(catalogRemaining({ quantity_total: 3, quantity_sold: 1, quantity_remaining: 1 })).toBe(1);
  });
  it("⚠️ server bermasa: total − sold − wasted − reworked", () => {
    expect(catalogRemaining({ quantity_total: 3, quantity_sold: 1, quantity_wasted: 0, quantity_reworked: 1 })).toBe(1);
  });
  it("⚠️ QADIMGI NOSOZLIK: `quantity_wasted` endi HISOBGA OLINADI", () => {
    // ilgari kod faqat total − sold qilardi → 3 chiqardi
    expect(catalogRemaining({ quantity_total: 3, quantity_sold: 0, quantity_wasted: 1 })).toBe(2);
  });
  it("restavratsiyadagi dona sotuvda ko'rinmaydi", () => {
    expect(catalogRemaining({ quantity_total: 3, quantity_sold: 1, quantity_reworked: 1 })).toBe(1);
  });
  it("hammasi buzilgan → 0", () => {
    expect(catalogRemaining({ quantity_total: 2, quantity_sold: 0, quantity_reworked: 2 })).toBe(0);
  });
  it("manfiyga tushmaydi", () => {
    expect(catalogRemaining({ quantity_total: 1, quantity_sold: 5 })).toBe(0);
  });
  it("maydonlarsiz eski obyekt → yiqilmaydi", () => {
    expect(catalogRemaining({ quantity_total: 2 })).toBe(2);
    expect(catalogRemaining(null)).toBe(0);
  });
  it("status=sold, sold bermagan → sotilgan deb qaraladi", () => {
    expect(catalogRemaining({ quantity_total: 1, status: "sold" })).toBe(0);
  });
});

describe("catalogCountsLabel — spec kartochka qatori", () => {
  it("⚠️ SPEC: «Jami 3 · Sotildi 1 · Restavratsiyada 1 · Qoldi 1»", () => {
    expect(catalogCountsLabel({ quantity_total: 3, quantity_sold: 1, quantity_reworked: 1, quantity_wasted: 0 }))
      .toBe("Jami 3 · Sotildi 1 · Restavratsiyada 1 · Qoldi 1");
  });
  it("nol qismlar TUSHIRILADI (toza qoladi)", () => {
    expect(catalogCountsLabel({ quantity_total: 2, quantity_sold: 0, quantity_reworked: 0 })).toBe("Jami 2 · Qoldi 2");
  });
  it("chiqit ham ko'rsatiladi", () => {
    expect(catalogCountsLabel({ quantity_total: 3, quantity_sold: 0, quantity_wasted: 1 })).toBe("Jami 3 · Chiqit 1 · Qoldi 2");
  });
});

describe("⚠️ stockAlreadyDeducted — «Skladdan yechish» ko'rsatilmaydi", () => {
  it("restavratsiya chiqimi: deducted = total → YASHIRILADI", () => {
    expect(stockAlreadyDeducted({ quantity_total: 2, quantity_stock_deducted: 2 })).toBe(true);
  });
  it("oddiy katalog: hali yechilmagan → ko'rsatiladi", () => {
    expect(stockAlreadyDeducted({ quantity_total: 2, quantity_stock_deducted: 0 })).toBe(false);
  });
  it("qisman yechilgan → hali ko'rsatiladi", () => {
    expect(stockAlreadyDeducted({ quantity_total: 3, quantity_stock_deducted: 1 })).toBe(false);
  });
});

describe("⚠️ PER-DONA TUZOG'I — quantity_stems BITTA dona uchun", () => {
  it("spec: quantity 2 × 25 dona = 50", () => {
    expect(outputTotalStems(OUT({ quantity: "2", composition: [{ stock_batch: 21, quantity_stems: "25" }] }))).toBe(50);
  });
  it("yorliq AYNAN spec eskizidagidek", () => {
    expect(perUnitLabel(25, 2)).toBe("25 dona/dona → jami 50 dona");
  });
  it("bir nechta tarkib qatori qo'shiladi, keyin ×dona", () => {
    expect(outputTotalStems(OUT({ quantity: "3", composition: [
      { stock_batch: 1, quantity_stems: "10" }, { stock_batch: 2, quantity_stems: "5" },
    ] }))).toBe(45);
  });
});

describe("kirim / chiqim / yo'qotish", () => {
  const byId = new Map([[41, ITEM(41, [{ batch: 21, n: 60 }])]]);
  it("itemStemsPerUnit — item o'z compositionidan", () => {
    expect(itemStemsPerUnit(ITEM(1, [{ batch: 1, n: 25 }, { batch: 2, n: 13 }]))).toBe(38);
  });
  it("sourceStems — bir dona guli × buzilgan dona", () => {
    expect(sourceStems([{ catalog_item: 41, quantity: 2 }], byId)).toBe(120);
  });
  it("stockStems — aniq dona", () => {
    expect(stockStems([{ stock_batch: 21, quantity_stems: "40" }, { stock_batch: 22, quantity_stems: "10" }])).toBe(50);
  });
  it("outputStems — hamma chiqim, ×dona", () => {
    expect(outputStems([
      OUT({ quantity: "2", composition: [{ stock_batch: 21, quantity_stems: "25" }] }),
      OUT({ quantity: "3", composition: [{ stock_batch: 21, quantity_stems: "15" }] }),
    ])).toBe(95);
  });
});

describe("⚠️ batchBalance — HAR BIR partiya alohida", () => {
  const byId = new Map([[41, ITEM(41, [{ batch: 21, n: 60 }])]]);
  it("mavjud = buzilgan katalogdagi + skladdan olingan", () => {
    const rows = batchBalance([{ catalog_item: 41, quantity: 1 }], [{ stock_batch: 21, quantity_stems: "40" }],
      [OUT({ quantity: "1", composition: [{ stock_batch: 21, quantity_stems: "80" }] })], byId, label);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ stock_batch: 21, available: 100, needed: 80, short: 0 });
  });
  it("⚠️ YETMASA — short > 0 va partiya NOMLANADI", () => {
    const rows = batchBalance([{ catalog_item: 41, quantity: 1 }], [],
      [OUT({ quantity: "1", composition: [{ stock_batch: 21, quantity_stems: "80" }] })], byId, label);
    expect(rows[0]).toMatchObject({ available: 60, needed: 80, short: 20, label: "EF-21" });
  });
  it("⚠️ UMUMIY son yetsa ham BITTA partiya yetmasligi mumkin", () => {
    const two = new Map([[41, ITEM(41, [{ batch: 1, n: 50 }, { batch: 2, n: 50 }])]]);
    const rows = batchBalance([{ catalog_item: 41, quantity: 1 }], [],
      [OUT({ quantity: "1", composition: [{ stock_batch: 1, quantity_stems: "80" }, { stock_batch: 2, quantity_stems: "20" }] })], two, label);
    const short = rows.filter((r) => r.short > 0);
    expect(short).toHaveLength(1);
    expect(short[0]).toMatchObject({ stock_batch: 1, available: 50, needed: 80, short: 30 });
  });
  it("yetishmovchilik BIRINCHI bo'lib chiqadi (operator darrov ko'rsin)", () => {
    const two = new Map([[41, ITEM(41, [{ batch: 1, n: 50 }, { batch: 2, n: 50 }])]]);
    const rows = batchBalance([{ catalog_item: 41, quantity: 1 }], [],
      [OUT({ quantity: "1", composition: [{ stock_batch: 1, quantity_stems: "10" }, { stock_batch: 2, quantity_stems: "90" }] })], two, label);
    expect(rows[0].stock_batch).toBe(2);
  });
});

describe("⚠️ SPEC 1-MISOLI — kichkinadan katta (uchdan-uchiga)", () => {
  const byId = new Map([[41, ITEM(41, [{ batch: 21, n: 25 }])]]);
  const t = reworkTotals({
    sources: [{ catalog_item: 41, quantity: 1 }],
    stock: [{ stock_batch: 21, quantity_stems: "25" }],
    outputs: [OUT({ name_uz: "Katta buket", quantity: "1", price: "900000", composition: [{ stock_batch: 21, quantity_stems: "50" }] })],
    florist: 3, floristAmount: "60000", byId, batchLabel: label, batchCost: cost,
  });
  it("input 50, output 50, waste 0", () => {
    expect(t.inputStems).toBe(50);
    expect(t.outputStems).toBe(50);
    expect(t.wasteStems).toBe(0);
  });
  it("yaroqli — bloklanmaydi", () => {
    expect(t.ok).toBe(true);
    expect(t.reason).toBe("");
  });
  it("partiya balansi teng", () => {
    expect(t.batches[0]).toMatchObject({ available: 50, needed: 50, short: 0 });
  });
});

describe("⚠️ SPEC 2-MISOLI — kattadan ikkita o'rtancha + uchta kichkina", () => {
  const byId = new Map([[41, ITEM(41, [{ batch: 21, n: 60 }])]]);
  const t = reworkTotals({
    sources: [{ catalog_item: 41, quantity: 1 }],
    stock: [{ stock_batch: 21, quantity_stems: "40" }],
    outputs: [
      OUT({ name_uz: "O'rtancha buket", quantity: "2", price: "450000", composition: [{ stock_batch: 21, quantity_stems: "25" }] }),
      OUT({ name_uz: "Kichkina buket", quantity: "3", price: "280000", composition: [{ stock_batch: 21, quantity_stems: "15" }] }),
    ],
    florist: 3, floristAmount: "150000", byId, batchLabel: label, batchCost: cost,
  });
  it("javobdagi AYNAN raqamlar: input 100, output 95, waste 5", () => {
    expect(t.inputStems).toBe(100);   // 60 + 40
    expect(t.outputStems).toBe(95);   // 2×25 + 3×15
    expect(t.wasteStems).toBe(5);
  });
  it("yaroqli", () => expect(t.ok).toBe(true));
});

describe("reworkTotals — BLOKLASH sabablari (jimgina o'chmaydi)", () => {
  const byId = new Map([[41, ITEM(41, [{ batch: 21, n: 60 }])]]);
  const base = { sources: [{ catalog_item: 41, quantity: 1 }], stock: [], byId, batchLabel: label, batchCost: cost, florist: 3, floristAmount: "0" };
  const good = OUT({ name_uz: "A", price: "1", composition: [{ stock_batch: 21, quantity_stems: "10" }] });
  it("florist tanlanmagan", () => {
    expect(reworkTotals({ ...base, florist: 0, outputs: [good] }).reason).toContain("Floristni tanlang");
  });
  it("manfiy haq", () => {
    expect(reworkTotals({ ...base, floristAmount: "-5", outputs: [good] }).reason).toBe("Florist haqi manfiy bo'lmaydi");
  });
  it("manba yo'q (spec matni)", () => {
    expect(reworkTotals({ ...base, sources: [], outputs: [good] }).reason)
      .toBe("Kamida bitta buziladigan katalog yoki skladdan gul tanlang");
  });
  it("chiqim yo'q (spec matni)", () => {
    expect(reworkTotals({ ...base, outputs: [] }).reason).toBe("Kamida bitta yangi mahsulot kiritilishi kerak");
  });
  it("tarkib bo'sh (spec matni)", () => {
    expect(reworkTotals({ ...base, outputs: [OUT({ name_uz: "O'rtancha buket", price: "1" })] }).reason)
      .toBe("O'rtancha buket uchun gul tarkibi kiritilmagan");
  });
  it("⚠️ chiqim kirimdan KO'P (spec matni)", () => {
    expect(reworkTotals({ ...base, outputs: [OUT({ name_uz: "A", price: "1", quantity: "1", composition: [{ stock_batch: 21, quantity_stems: "70" }] })] }).reason)
      .toBe("Yangi mahsulotlardagi gul soni kirimdan ko'p bo'lmasligi kerak");
  });
  it("nomsiz mahsulot", () => {
    expect(reworkTotals({ ...base, outputs: [OUT({ price: "1", composition: [{ stock_batch: 21, quantity_stems: "1" }] })] }).reason)
      .toContain("nom kiriting");
  });
  it("narxsiz mahsulot", () => {
    expect(reworkTotals({ ...base, outputs: [OUT({ name_uz: "A", composition: [{ stock_batch: 21, quantity_stems: "1" }] })] }).reason)
      .toContain("narxini kiriting");
  });
  it("⚠️ haq 0 — BLOKLAMAYDI (oylik yozuvi yaratilmaydi, xolos)", () => {
    expect(reworkTotals({ ...base, outputs: [good] }).ok).toBe(true);
  });
});

describe("buildReworkPayload", () => {
  const mk = (o: Partial<Parameters<typeof buildReworkPayload>[0]> = {}) => buildReworkPayload({
    florist: 3, floristAmount: "150000", note: "",
    sources: [{ catalog_item: 41, quantity: 1 }],
    stock: [{ stock_batch: 21, quantity_stems: "40" }],
    outputs: [OUT({ name_uz: "O'rtancha buket", quantity: "2", price: "450000",
      composition: [{ stock_batch: 21, quantity_stems: "25" }], materials: [{ packaging: 7, quantity: "1" }] })],
    ...o,
  });
  it("⚠️ SPEC so'rovi bilan bir xil shakl", () => {
    expect(mk()).toEqual({
      florist: 3, florist_amount: "150000",
      sources: [{ catalog_item: 41, quantity: 1 }],
      stock_inputs: [{ stock_batch: 21, quantity_stems: 40 }],
      outputs: [{ name_uz: "O'rtancha buket", price: "450000", quantity: 2,
        composition: [{ stock_batch: 21, quantity_stems: 25 }], materials: [{ packaging: 7, quantity: 1 }] }],
    });
  });
  it("⚠️ tarkib PER-DONA qoladi (×quantity QILINMAYDI — buni server biladi)", () => {
    const out = (mk().outputs as Record<string, unknown>[])[0];
    expect((out.composition as Record<string, number>[])[0].quantity_stems).toBe(25);
    expect(out.quantity).toBe(2);
  });
  it("⚠️ haq 0 → `florist_amount` kaliti YO'Q (oylik yozuvi yaratilmaydi)", () => {
    expect("florist_amount" in mk({ floristAmount: "0" })).toBe(false);
    expect("florist_amount" in mk({ floristAmount: "" })).toBe(false);
  });
  it("bo'sh izoh → kalit yo'q", () => expect("note" in mk()).toBe(false));
  it("izoh bor → yuboriladi", () => expect(mk({ note: " Vitrinadagi " }).note).toBe("Vitrinadagi"));
  it("sources bo'sh → kalit YO'Q (stock_inputs bilan ishlaydi)", () => {
    expect("sources" in mk({ sources: [] })).toBe(false);
  });
  it("stock_inputs bo'sh → kalit YO'Q (spec: birlashtirish misoli)", () => {
    expect("stock_inputs" in mk({ stock: [] })).toBe(false);
  });
  it("quantity 1 → kalit YO'Q (server sukuti)", () => {
    const out = (mk({ outputs: [OUT({ name_uz: "A", quantity: "1", price: "1", composition: [{ stock_batch: 1, quantity_stems: "1" }] })] }).outputs as Record<string, unknown>[])[0];
    expect("quantity" in out).toBe(false);
  });
  it("⚠️ «Qo'shimcha» TEGILMASA — hech biri yuborilmaydi", () => {
    const out = (mk().outputs as Record<string, unknown>[])[0];
    for (const k of ["volume", "description_uz", "note", "height_cm", "diameter_cm", "image_url", "status", "branch", "catalog_kind", "arrangement_type"]) {
      expect(k in out).toBe(false);
    }
  });
  it("«Qo'shimcha» to'ldirilsa — yuboriladi", () => {
    const out = (mk({ outputs: [OUT({ name_uz: "A", price: "1", composition: [{ stock_batch: 1, quantity_stems: "1" }],
      volume: "Katta", height_cm: "50", status: "draft", catalog_kind: "custom", arrangement_type: "basket", branch: 2 })] }).outputs as Record<string, unknown>[])[0];
    expect(out).toMatchObject({ volume: "Katta", height_cm: 50, status: "draft", catalog_kind: "custom", arrangement_type: "basket", branch: 2 });
  });
  it("bo'sh tarkib/material qatorlari TASHLANADI", () => {
    const out = (mk({ outputs: [OUT({ name_uz: "A", price: "1",
      composition: [{ stock_batch: 1, quantity_stems: "5" }, { stock_batch: 0, quantity_stems: "9" }],
      materials: [{ packaging: 0, quantity: "1" }] })] }).outputs as Record<string, unknown>[])[0];
    expect(out.composition).toHaveLength(1);
    expect("materials" in out).toBe(false);
  });
});
