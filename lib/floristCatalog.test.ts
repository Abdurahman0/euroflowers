import { describe, it, expect } from "vitest";
import { buildFloristComposition, catalogWaiting, catalogClosed } from "./inventory";

// FLORIST_KATALOG_GUL_TANLASH.md — florist katalogida gul TANLANADI, faqat soni yozilmaydi.
// composition = [{ stock_batch }] (quantity_stems YUBORILMAYDI); waiting = some(q===0).

describe("FK1 — florist composition payload (gul tanlanadi, son yo'q)", () => {
  it("bitta gul → [{ stock_batch }], quantity_stems umuman yo'q", () => {
    const out = buildFloristComposition([94]);
    expect(out).toEqual([{ stock_batch: 94 }]);
    // ⚠️ quantity_stems yuborilmasligi shart — u 0 bo'lib turadi va chiqim yopilganda hisoblanadi
    expect(out.every((r) => !("quantity_stems" in r))).toBe(true);
  });

  it("ikki xil gul (qizil + oq) → ikkala batch ham qatorga tushadi", () => {
    expect(buildFloristComposition([94, 77])).toEqual([{ stock_batch: 94 }, { stock_batch: 77 }]);
  });

  it("dublikat va bo'sh (0) qatorlar tashlanadi", () => {
    expect(buildFloristComposition([94, 94, 0, 77, 0])).toEqual([{ stock_batch: 94 }, { stock_batch: 77 }]);
  });

  it("hech narsa tanlanmagan → bo'sh massiv", () => {
    expect(buildFloristComposition([])).toEqual([]);
    expect(buildFloristComposition([0, 0])).toEqual([]);
  });
});

describe("FK2 — operator (floristsiz) katalogi: gul VA soni ikkalasi ham (o'zgarmadi)", () => {
  // Operator payload'i KatalogModal'da normalizeComposition orqali quantity_stems bilan quriladi.
  // Bu yerda kontrakt sifatida tekshiramiz: buildFloristComposition faqat florist rejim uchun,
  // u hech qachon quantity_stems chiqarmaydi — operator uni ISHLATMAYDI.
  it("buildFloristComposition operator uchun EMAS — u son chiqarmaydi", () => {
    const out = buildFloristComposition([1]);
    expect(JSON.stringify(out)).toBe('[{"stock_batch":1}]');
  });
});

describe("FK3 — «chiqim yopilishini kutayapti» predikati (yagona manba)", () => {
  it("YANGI (soni 0) florist item → kutayapti", () => {
    expect(catalogWaiting({ florist: 4, composition: [{ quantity_stems: 0 }] })).toBe(true);
  });

  it("ESKI bo'sh-kompozitsiyali florist item → kutayapti (regressiya qoplandi)", () => {
    expect(catalogWaiting({ florist: 4, composition: [] })).toBe(true);
    expect(catalogWaiting({ florist: 4, composition: null })).toBe(true);
  });

  it("YOPILGAN (hamma qatorda son > 0) florist item → kutmayapti", () => {
    expect(catalogWaiting({ florist: 4, composition: [{ quantity_stems: 100 }, { quantity_stems: 100 }] })).toBe(false);
  });

  it("QISMAN to'lgan (qizil to'ldi, oq hali 0) → HALI kutayapti (§0b: partial ≠ done)", () => {
    expect(catalogWaiting({ florist: 4, composition: [{ quantity_stems: 100 }, { quantity_stems: 0 }] })).toBe(true);
  });

  it("operator (floristsiz) katalogi HECH QACHON kutayapti emas", () => {
    expect(catalogWaiting({ florist: null, composition: [{ quantity_stems: 0 }] })).toBe(false);
    expect(catalogWaiting({ florist: 0, composition: [] })).toBe(false);
  });
});

describe("FK4 — catalogClosed = kutayaptining aksi (faqat florist itemlar uchun)", () => {
  it("hamma qatorda son > 0 → yopilgan", () => {
    expect(catalogClosed({ florist: 4, composition: [{ quantity_stems: 100 }] })).toBe(true);
  });
  it("bitta qator hali 0 → yopilmagan", () => {
    expect(catalogClosed({ florist: 4, composition: [{ quantity_stems: 100 }, { quantity_stems: 0 }] })).toBe(false);
  });
  it("bo'sh kompozitsiya → yopilmagan", () => {
    expect(catalogClosed({ florist: 4, composition: [] })).toBe(false);
  });
  it("operator item → hech qachon yopilgan (florist-holati) emas", () => {
    expect(catalogClosed({ florist: null, composition: [{ quantity_stems: 100 }] })).toBe(false);
  });
});

describe("FK5 — florist almashsa tanlov invalidatsiya (kontrakt)", () => {
  // KatalogModal prevFlorist effekti floristBatches'ni []'ga tozalaydi. Bu yerda quyi
  // qatlam kontraktini tekshiramiz: yangi floristda ushlanmaydigan batch payloadga TUSHMAYDI
  // (picker uni invalid deb belgilaydi, foydalanuvchi olib tashlaydi → 0 → filtrlanadi).
  it("tanlov tozalangach payload bo'sh — validatsiya «Gulni tanlang» beradi", () => {
    // florist almashdi → floristBatches = [] → buildFloristComposition([]) = []
    expect(buildFloristComposition([])).toHaveLength(0);
  });
});
