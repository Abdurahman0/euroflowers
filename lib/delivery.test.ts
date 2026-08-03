import { describe, it, expect } from "vitest";
import { roundToHundred, perStemFromBunch, exactPerStem, roundingNote, buildBatchPayload, roundingHint, deliveryRoundingHint } from "./inventory";
import type { RoundingSide } from "./types";

// ── DR1: rounding parity — EVERY row of the spec table (client must equal server)
describe("DR1 — pochka→dona rounding matches the spec table exactly", () => {
  // [bunch, stemsPerBunch, exact, stored]
  const rows: [number, number, number, number][] = [
    [25000, 25, 1000, 1000],
    [24950, 25, 998, 1000],
    [24900, 25, 996, 1000],
    [25100, 25, 1004, 1000],
    [26300, 25, 1052, 1100],
    [26500, 25, 1060, 1100],
  ];
  it.each(rows)("bunch %d ÷ %d = exact %d → stored %d", (bunch, spb, exact, stored) => {
    expect(exactPerStem(bunch, spb)).toBe(exact);
    expect(perStemFromBunch(bunch, spb)).toBe(stored);
  });

  it("divides THEN rounds (not round-then-divide): 24950/25=998→1000, not round(24950)/25", () => {
    expect(perStemFromBunch(24950, 25)).toBe(1000); // divide first: 998 → 1000
  });

  it("half-up: exact .5 boundary rounds UP (yarmi va undan yuqorisi tepaga)", () => {
    expect(roundToHundred(1050)).toBe(1100); // 10.5 → 11
    expect(roundToHundred(950)).toBe(1000);  // 9.5 → 10
    expect(roundToHundred(50)).toBe(100);    // 0.5 → 1
    expect(roundToHundred(150)).toBe(200);   // 1.5 → 2
    expect(roundToHundred(250)).toBe(300);   // 2.5 → 3
  });

  it("sub-50 per-stem ZEROES the cost basis (the cliff)", () => {
    expect(perStemFromBunch(49, 1)).toBe(0);   // 49 → 0
    expect(perStemFromBunch(1225, 25)).toBe(0); // 49/stem → 0
    expect(perStemFromBunch(50, 1)).toBe(100);  // 50 → 100 (50–149 → 100)
    expect(perStemFromBunch(149, 1)).toBe(100); // 149 → 100
  });

  it("roundingNote flags changed + zeroed with the exact figure", () => {
    const a = roundingNote(24950, 25); // 998 → 1000
    expect(a).toEqual({ rounded: 1000, exact: 998, changed: true, zeroed: false });
    const b = roundingNote(25000, 25); // 1000 → 1000
    expect(b.changed).toBe(false);
    const z = roundingNote(1000, 25); // 40 → 0
    expect(z.zeroed).toBe(true);
    expect(z.rounded).toBe(0);
  });

  it("guards divide-by-zero stems", () => {
    expect(exactPerStem(25000, 0)).toBe(0);
    expect(perStemFromBunch(25000, 0)).toBe(0);
  });
});

// ── DR2: payload builder — never send both bunch+stem unless override; delivery omits 3 fields
describe("DR2 — buildBatchPayload send-rules", () => {
  const base = { variant: 31, heightCm: 50, stemsPerBunch: 25 };

  it("bunch only (default): cost/sale per-bunch sent, per-stem NOT sent", () => {
    const p = buildBatchPayload({ ...base, costPerBunch: "25000", salePerBunch: "50000" });
    expect(p.cost_per_bunch).toBe("25000");
    expect(p.sale_price_per_bunch).toBe("50000");
    expect("cost_per_stem" in p).toBe(false);
    expect("sale_price_per_stem" in p).toBe(false);
  });

  it("stem only: per-stem sent, per-bunch NOT sent (server computes bunch)", () => {
    const p = buildBatchPayload({ ...base, costPerStem: "1000", salePerStem: "2000" });
    expect(p.cost_per_stem).toBe("1000");
    expect("cost_per_bunch" in p).toBe(false);
  });

  it("explicit override: BOTH sent knowingly (server stores verbatim, computes nothing)", () => {
    const p = buildBatchPayload({ ...base, costPerBunch: "25000", costPerStem: "999" });
    expect(p.cost_per_bunch).toBe("25000");
    expect(p.cost_per_stem).toBe("999");
  });

  it("delivery-bound: delivery sent; batch_number/received_at/supplier OMITTED", () => {
    const p = buildBatchPayload({ ...base, deliveryId: 2, supplier: 22, batchNumber: "7", receivedAt: "2026-08-01", costPerBunch: "25000" });
    expect(p.delivery).toBe(2);
    expect("batch_number" in p).toBe(false);
    expect("received_at" in p).toBe(false);
    expect("supplier" in p).toBe(false);
  });

  it("no delivery: the three fields ARE sent when provided", () => {
    const p = buildBatchPayload({ ...base, supplier: 22, batchNumber: "EF-1", receivedAt: "2026-08-01T10:00", costPerBunch: "25000" });
    expect(p.supplier).toBe(22);
    expect(p.batch_number).toBe("EF-1");
    expect(p.received_at).toBe("2026-08-01"); // sliced to date
  });

  it("quantity: bunch XOR stem — bunch wins if both accidentally set", () => {
    expect(buildBatchPayload({ ...base, receivedBunches: 8 }).received_bunches).toBe("8.00");
    expect(buildBatchPayload({ ...base, receivedStems: 200 }).received_stems).toBe(200);
    const both = buildBatchPayload({ ...base, receivedBunches: 8, receivedStems: 200 });
    expect(both.received_bunches).toBe("8.00");
    expect("received_stems" in both).toBe(false);
  });
});

// ── DR3: display-only rounding hints — only surface when is_rounded, never compute
const side = (over?: Partial<RoundingSide>): RoundingSide => ({
  per_stem_exact: 998, per_stem_rounded: 1000, per_stem_diff: 2,
  total_exact: 99800, total_rounded: 100000, total_diff: 200, is_rounded: true, ...over,
});
// ru locale ajratgichi — nabel probel (U+00A0); taqqoslashda oddiy probelga keltiramiz
const nsp = (s: string | null) => (s == null ? null : s.replace(/ /g, " "));
describe("DR3 — roundingHint / deliveryRoundingHint (DISPLAY-ONLY, server numbers)", () => {
  it("roundingHint returns '(aniq …)' only when is_rounded=true", () => {
    expect(nsp(roundingHint(side()))).toBe("aniq: 998 · +2");
    expect(roundingHint(side({ is_rounded: false }))).toBeNull(); // flat split → nothing shown
    expect(roundingHint(undefined)).toBeNull();
    expect(roundingHint(null)).toBeNull();
  });
  it("roundingHint reads the server's exact/diff verbatim — does NOT recompute", () => {
    // even if per_stem_rounded/exact are internally inconsistent, we echo the server's diff
    expect(nsp(roundingHint(side({ per_stem_exact: 1060, per_stem_diff: 40 })))).toBe("aniq: 1 060 · +40");
  });
  it("deliveryRoundingHint only when rounding_diff != 0", () => {
    expect(nsp(deliveryRoundingHint({ total_cost_exact: 99800, rounding_diff: 200 }))).toBe("aniq hisob: 99 800 · yaxlitlashdan +200");
    expect(deliveryRoundingHint({ total_cost_exact: 100000, rounding_diff: 0 })).toBeNull();
    expect(deliveryRoundingHint({ total_cost_exact: 100000 })).toBeNull(); // no diff field → nothing
  });
});

// ── DR4: buildBatchEditPayload — changed-only PATCH (never full-object overwrite)
import { buildBatchEditPayload, batchEditIsRetroactive, type BatchEditForm, type BatchEditOriginal } from "./inventory";

const orig: BatchEditOriginal = {
  batch_number: "EF-1", received_at: "2026-08-01", height_cm: 50, stems_per_bunch: 25, variant: 41, delivery: 3,
  minimum_sale_stems: 5, notes: "old", image_url: "img.jpg",
  cost_per_bunch: "25000.00", sale_price_per_bunch: "50000.00", cost_per_stem: "1000.00", sale_price_per_stem: "2000.00",
};
const baseForm: BatchEditForm = {
  batch_number: "EF-1", received_at: "2026-08-01", height_cm: "50", received_stems: "", variant: 41, delivery: 3, is_free: false, remainingManual: false, remaining_stems: "", stems_per_bunch: "25",
  minimum_sale_stems: "5", notes: "old", image_url: "img.jpg",
  cost_per_bunch: "25000", sale_price_per_bunch: "50000", cost_per_stem: "1000", sale_price_per_stem: "2000",
  costManual: false, saleManual: false,
};

describe("DR4 — buildBatchEditPayload (changed-only)", () => {
  it("nothing changed → EMPTY payload (no full-object overwrite)", () => {
    expect(buildBatchEditPayload(orig, baseForm)).toEqual({});
  });
  it("numeric equality ignores decimal formatting (25000 == 25000.00)", () => {
    expect(buildBatchEditPayload(orig, { ...baseForm, cost_per_bunch: "25000" })).toEqual({});
  });
  it("one field changed → ONLY that key", () => {
    expect(buildBatchEditPayload(orig, { ...baseForm, notes: "new note" })).toEqual({ notes: "new note" });
    expect(buildBatchEditPayload(orig, { ...baseForm, height_cm: "60" })).toEqual({ height_cm: 60 });
    expect(buildBatchEditPayload(orig, { ...baseForm, minimum_sale_stems: "10" })).toEqual({ minimum_sale_stems: 10 });
  });
  it("cost changed via BUNCH (auto) → cost_per_bunch only, cost_per_stem OMITTED", () => {
    const p = buildBatchEditPayload(orig, { ...baseForm, cost_per_bunch: "26000" });
    expect(p).toEqual({ cost_per_bunch: "26000" });
    expect("cost_per_stem" in p).toBe(false);
  });
  it("explicit per-stem OVERRIDE (manual) → BOTH sent when both changed", () => {
    const p = buildBatchEditPayload(orig, { ...baseForm, costManual: true, cost_per_bunch: "26000", cost_per_stem: "999" });
    expect(p).toEqual({ cost_per_bunch: "26000", cost_per_stem: "999" });
  });
  it("manual override, only per-stem changed → stem only (bunch untouched)", () => {
    const p = buildBatchEditPayload(orig, { ...baseForm, costManual: true, cost_per_stem: "1050" });
    expect(p).toEqual({ cost_per_stem: "1050" });
  });
  it("sale price change is independent of cost", () => {
    expect(buildBatchEditPayload(orig, { ...baseForm, sale_price_per_bunch: "55000" })).toEqual({ sale_price_per_bunch: "55000" });
  });
  it("batchEditIsRetroactive flags cost / stems_per_bunch changes only", () => {
    expect(batchEditIsRetroactive({ notes: "x" })).toBe(false);
    expect(batchEditIsRetroactive({ sale_price_per_bunch: "55000" })).toBe(false);
    expect(batchEditIsRetroactive({ cost_per_bunch: "26000" })).toBe(true);
    expect(batchEditIsRetroactive({ stems_per_bunch: 20 })).toBe(true);
    expect(batchEditIsRetroactive({ cost_per_stem: "999" })).toBe(true);
  });
});

// ── DR5 KO'CHIRILDI → lib/materialUnit.test.ts (unit-aware receive: dona + pochka)

// ── KELGAN MIQDORNI TO'G'RILASH (received_stems) — oqibat hisobi + payload intizomi
import { receivedEditConsequence } from "./inventory";

const ORIG: BatchEditOriginal = {
  batch_number: "B-1", received_at: "2026-08-01", height_cm: 60, stems_per_bunch: 25,
  minimum_sale_stems: 1, notes: "", image_url: "",
  cost_per_bunch: "25000", sale_price_per_bunch: "50000", cost_per_stem: "1000", sale_price_per_stem: "2000",
  received_stems: 100, remaining_stems: 20, variant: 41, delivery: 3, // ya'ni 80 dona ALLAQACHON ishlatilgan
};
const FORM = (over: Partial<BatchEditForm> = {}): BatchEditForm => ({
  batch_number: "B-1", received_at: "2026-08-01", height_cm: "60",
  received_stems: "100", variant: 41, delivery: 3, is_free: false, remainingManual: false, remaining_stems: "20", stems_per_bunch: "25", minimum_sale_stems: "1", notes: "", image_url: "",
  cost_per_bunch: "25000", sale_price_per_bunch: "50000", cost_per_stem: "1000", sale_price_per_stem: "2000",
  costManual: false, saleManual: false, ...over,
});

describe("receivedEditConsequence — «ishlatilgan» va yangi qoldiq", () => {
  it("ishlatilgan = kelgan − qoldiq (florist chiqimi/qaytarish/chiqit/katalog — hammasi qoldiqda)", () => {
    expect(receivedEditConsequence(100, 20, 100).used).toBe(80);
  });
  it("OSHIRISH xavfsiz: 100 → 150 · qoldiq 20 → 70", () => {
    const c = receivedEditConsequence(100, 20, 150);
    expect(c).toMatchObject({ used: 80, receivedTo: 150, remainingTo: 70, changed: true, decreasing: false, negative: false });
  });
  it("XAVFSIZ kamaytirish: 100 → 90 · qoldiq 20 → 10", () => {
    const c = receivedEditConsequence(100, 20, 90);
    expect(c).toMatchObject({ receivedTo: 90, remainingTo: 10, decreasing: true, negative: false });
  });
  it("AYNAN ishlatilganga teng (100 → 80) — RUXSAT, qoldiq 0", () => {
    const c = receivedEditConsequence(100, 20, 80);
    expect(c).toMatchObject({ receivedTo: 80, remainingTo: 0, negative: false });
  });
  it("⚠️ ISHLATILGANDAN KAM (100 → 50) — qoldiq −30, BLOKLANADI", () => {
    const c = receivedEditConsequence(100, 20, 50);
    expect(c).toMatchObject({ used: 80, receivedTo: 50, remainingTo: -30, negative: true, decreasing: true });
  });
  it("o'zgarmasa changed=false", () => expect(receivedEditConsequence(100, 20, 100).changed).toBe(false));
  it("hech narsa ishlatilmagan partiyada istalgan kamaytirish xavfsiz", () => {
    expect(receivedEditConsequence(100, 100, 1)).toMatchObject({ used: 0, remainingTo: 1, negative: false });
  });
  it("buzuq/bo'sh kirish → asl qiymat (changed=false, blok yo'q)", () => {
    expect(receivedEditConsequence(100, 20, "")).toMatchObject({ receivedTo: 100, changed: false, negative: false });
    expect(receivedEditConsequence(100, 20, "abc")).toMatchObject({ receivedTo: 100, changed: false });
  });
});

describe("buildBatchEditPayload — received_stems FAQAT o'zgarganda va FAQAT xavfsiz bo'lsa", () => {
  it("tegilmagan → kalit YO'Q", () => {
    expect("received_stems" in buildBatchEditPayload(ORIG, FORM())).toBe(false);
  });
  it("oshirilgan → yuboriladi", () => {
    expect(buildBatchEditPayload(ORIG, FORM({ received_stems: "150" })).received_stems).toBe(150);
  });
  it("xavfsiz kamaytirilgan → yuboriladi", () => {
    expect(buildBatchEditPayload(ORIG, FORM({ received_stems: "90" })).received_stems).toBe(90);
  });
  it("⚠️ ishlatilgandan KAM → kalit UMUMAN yuborilmaydi (server 500 ko'rmaydi)", () => {
    expect("received_stems" in buildBatchEditPayload(ORIG, FORM({ received_stems: "50" }))).toBe(false);
  });
  it("boshqa maydonlar tegilmagan bo'lsa ular ham yuborilmaydi (faqat o'zgargan kalitlar)", () => {
    const p = buildBatchEditPayload(ORIG, FORM({ received_stems: "150" }));
    expect(Object.keys(p)).toEqual(["received_stems"]);
  });
  it("received_stems RETROAKTIV deb belgilanadi (yuk jamilari/tannarx siljiydi)", () => {
    expect(batchEditIsRetroactive({ received_stems: 150 })).toBe(true);
    expect(batchEditIsRetroactive({ notes: "x" })).toBe(false);
  });
});

// ── TEKIN GUL (is_free) — payload intizomi + barqaror tartib
import { isFreeBatch, batchCostLabel, compareBatchNewestFirst } from "./inventory";

describe("TEKIN GUL — buildBatchPayload (create)", () => {
  const base = { variant: 31, heightCm: 60, stemsPerBunch: 25, deliveryId: 19, receivedStems: 100, salePerBunch: "50000" };
  it("TEKIN: is_free yuboriladi, tannarx kalitlari UMUMAN yo'q", () => {
    const p = buildBatchPayload({ ...base, isFree: true, costPerBunch: "99000", costPerStem: "4000" });
    expect(p.is_free).toBe(true);
    expect("cost_per_bunch" in p).toBe(false);
    expect("cost_per_stem" in p).toBe(false);
    expect(p.sale_price_per_bunch).toBe("50000"); // sotuv narxi QOLADI
  });
  it("PULLIK: is_free yuborilmaydi, tannarx odatdagidek ketadi", () => {
    const p = buildBatchPayload({ ...base, costPerBunch: "25000" });
    expect("is_free" in p).toBe(false);
    expect(p.cost_per_bunch).toBe("25000");
  });
  it("TEKIN + tannarx qo'lda override — baribir yuborilmaydi (server tozalashiga tayanmaymiz)", () => {
    const p = buildBatchPayload({ ...base, isFree: true, costPerStem: "4000" });
    expect("cost_per_stem" in p).toBe(false);
  });
});

describe("TEKIN GUL — buildBatchEditPayload (PATCH, faqat o'zgargan)", () => {
  const O: BatchEditOriginal = { ...ORIG, is_free: false };
  it("tekinga o'tkazildi → is_free:true, tannarx kalitlari yo'q", () => {
    const p = buildBatchEditPayload(O, FORM({ is_free: true, cost_per_bunch: "99000" }));
    expect(p.is_free).toBe(true);
    expect("cost_per_bunch" in p).toBe(false);
  });
  it("tekindan pullikka qaytarildi → is_free:false va tannarx yana yuboriladi", () => {
    const p = buildBatchEditPayload({ ...O, is_free: true }, FORM({ is_free: false, cost_per_bunch: "30000" }));
    expect(p.is_free).toBe(false);
    expect(p.cost_per_bunch).toBe("30000");
  });
  it("is_free tegilmagan → kalit yuborilmaydi", () => {
    expect("is_free" in buildBatchEditPayload(O, FORM({}))).toBe(false);
  });
  it("is_free RETROAKTIV (tannarx asosini qayta yozadi)", () => {
    expect(batchEditIsRetroactive({ is_free: true })).toBe(true);
  });
});

describe("TEKIN GUL — ko'rsatish", () => {
  it("isFreeBatch xavfsiz o'qiydi (maydon yo'q bo'lsa false)", () => {
    expect(isFreeBatch({ is_free: true })).toBe(true);
    expect(isFreeBatch({})).toBe(false);
    expect(isFreeBatch(null)).toBe(false);
  });
  it("tekin tannarx «0 so'm · tekin» bo'lib o'qiladi (yalang 0 emas)", () => {
    expect(batchCostLabel({ is_free: true }, "0 so'm")).toBe("0 so'm · tekin");
    expect(batchCostLabel({ is_free: false }, "25 000 so'm")).toBe("25 000 so'm");
  });
});

describe("compareBatchNewestFirst — BARQAROR «oxirgi qo'shilgan birinchi»", () => {
  const b = (id: number, received_at: string, created_at?: string) => ({ id, received_at, created_at });
  it("sana bo'yicha kamayish tartibida", () => {
    const xs = [b(1, "2026-08-01"), b(2, "2026-08-03"), b(3, "2026-08-02")].sort(compareBatchNewestFirst);
    expect(xs.map((x) => x.id)).toEqual([2, 3, 1]);
  });
  it("⚠️ BIR XIL SANA → created_at ↓ (server bu yerda beqaror)", () => {
    const xs = [
      b(10, "2026-08-02", "2026-08-03T08:00:00"),
      b(11, "2026-08-02", "2026-08-03T12:00:00"),
      b(12, "2026-08-02", "2026-08-03T10:00:00"),
    ].sort(compareBatchNewestFirst);
    expect(xs.map((x) => x.id)).toEqual([11, 12, 10]);
  });
  it("sana VA created_at bir xil → id ↓ (yakuniy barqaror kalit)", () => {
    const xs = [b(5, "2026-08-02", "T"), b(9, "2026-08-02", "T"), b(7, "2026-08-02", "T")].sort(compareBatchNewestFirst);
    expect(xs.map((x) => x.id)).toEqual([9, 7, 5]);
  });
  it("BARQAROR: kirish tartibi o'zgarsa ham natija BIR XIL (render'lar orasida sakramaydi)", () => {
    const rows = [b(104, "2026-08-02", "2026-08-03T08:34"), b(109, "2026-08-02", "2026-08-03T12:11"), b(106, "2026-08-02", "2026-08-03T12:08")];
    const a = [...rows].sort(compareBatchNewestFirst).map((x) => x.id);
    const c = [...rows].reverse().sort(compareBatchNewestFirst).map((x) => x.id);
    expect(a).toEqual(c);
    expect(a).toEqual([109, 106, 104]);
  });
  it("sanasiz qatorlar oxiriga tushadi, lekin tartibi barqaror", () => {
    const xs = [b(1, ""), b(2, "2026-08-01"), b(3, "")].sort(compareBatchNewestFirst);
    expect(xs.map((x) => x.id)).toEqual([2, 3, 1]);
  });
});

// ── SPEC jadvali (POSTAVSHIK_QARZ_VA_PARTIYA_TAHRIRI §2) — UCHALA qator AYNAN
describe("received_stems — spec jadvalining uchala qatori", () => {
  it("100 → 120 (30 ishlatilgan) → qoldiq 90, RUXSAT", () => {
    expect(receivedEditConsequence(100, 70, 120)).toMatchObject({ used: 30, receivedTo: 120, remainingTo: 90, negative: false });
  });
  it("100 → 80 (30 ishlatilgan) → qoldiq 50, RUXSAT (KAMAYTIRISH bloklanmaydi)", () => {
    expect(receivedEditConsequence(100, 70, 80)).toMatchObject({ used: 30, receivedTo: 80, remainingTo: 50, negative: false, decreasing: true });
  });
  it("120 → 10 (30 ishlatilgan) → qoldiq −20, BLOKLANADI (server 400 beradi)", () => {
    expect(receivedEditConsequence(120, 90, 10)).toMatchObject({ used: 30, receivedTo: 10, remainingTo: -20, negative: true });
  });
  it("POL = ishlatilgan: aynan 30 ga tushirish RUXSAT (qoldiq 0)", () => {
    expect(receivedEditConsequence(120, 90, 30)).toMatchObject({ remainingTo: 0, negative: false });
  });
  it("poldan 1 dona past → bloklanadi", () => {
    expect(receivedEditConsequence(120, 90, 29)).toMatchObject({ remainingTo: -1, negative: true });
  });
});

describe("⚠️ remaining_stems payload'ga FAQAT ataylab qo'shiladi", () => {
  const O: BatchEditOriginal = { ...ORIG, received_stems: 100, remaining_stems: 20 };
  it("kelgan o'zgardi, qo'lda qoldiq O'CHIQ → remaining_stems YO'Q (server o'zi hisoblaydi)", () => {
    const p = buildBatchEditPayload(O, FORM({ received_stems: "120" }));
    expect(p.received_stems).toBe(120);
    expect("remaining_stems" in p).toBe(false);
  });
  it("qo'lda qoldiq YOQILGAN va o'zgargan → ikkalasi ham yuboriladi", () => {
    const p = buildBatchEditPayload(O, FORM({ received_stems: "120", remainingManual: true, remaining_stems: "65" }));
    expect(p).toMatchObject({ received_stems: 120, remaining_stems: 65 });
  });
  it("qo'lda qoldiq yoqilgan LEKIN qiymat o'zgarmagan → kalit yo'q", () => {
    const p = buildBatchEditPayload(O, FORM({ remainingManual: true, remaining_stems: "20" }));
    expect("remaining_stems" in p).toBe(false);
  });
  it("qo'lda qoldiq O'CHIQ bo'lsa, maydonda qiymat qolsa ham YUBORILMAYDI", () => {
    const p = buildBatchEditPayload(O, FORM({ remainingManual: false, remaining_stems: "999" }));
    expect("remaining_stems" in p).toBe(false);
  });
  it("hech narsa o'zgarmadi → BO'SH payload", () => {
    expect(buildBatchEditPayload(O, FORM({ received_stems: "100" }))).toEqual({});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PARTIYA QIDIRUVI — bo'y bilan («prut 40»)
// ─────────────────────────────────────────────────────────────────────────────
import { batchMatchesQuery, compareCatalogNewestFirst } from "./inventory";
describe("batchMatchesQuery — ko'p so'zli qidiruv, BO'Y ham qamrab olinadi", () => {
  const B = (flower: string, variant: string, cm: number, extra: Record<string, unknown> = {}) => ({
    batch_number: "B-0501",
    height_cm: cm,
    height_label: `${cm} sm`,
    variant_detail: { name_uz: variant, color_uz: "Qizil", flower_detail: { name_uz: flower } },
    ...extra,
  });
  const prut40 = B("Prut", "Yashil", 40);
  const prut60 = B("Prut", "Yashil", 60);
  const atirgul40 = B("Atirgul", "Freedom", 40);

  it("⚠️ ASOSIY HOLAT: «prut 40» → faqat 40 sm li Prut", () => {
    expect(batchMatchesQuery(prut40, "prut 40")).toBe(true);
    expect(batchMatchesQuery(prut60, "prut 40")).toBe(false);
    expect(batchMatchesQuery(atirgul40, "prut 40")).toBe(false);
  });
  it("bitta so'z — ilgarigidek ishlaydi (gul nomi)", () => {
    expect(batchMatchesQuery(prut60, "prut")).toBe(true);
    expect(batchMatchesQuery(atirgul40, "prut")).toBe(false);
  });
  it("faqat bo'y bo'yicha ham topiladi", () => {
    expect(batchMatchesQuery(prut40, "40")).toBe(true);
    expect(batchMatchesQuery(prut60, "40")).toBe(false);
  });
  it("«40 sm» yozilsa ham topiladi", () => {
    expect(batchMatchesQuery(prut40, "40 sm")).toBe(true);
  });
  it("so'zlar tartibi AHAMIYATSIZ — «40 prut» ham ishlaydi", () => {
    expect(batchMatchesQuery(prut40, "40 prut")).toBe(true);
  });
  it("nav va rang bo'yicha ham (eski xatti-harakat saqlangan)", () => {
    expect(batchMatchesQuery(atirgul40, "freedom")).toBe(true);
    expect(batchMatchesQuery(atirgul40, "qizil")).toBe(true);
    expect(batchMatchesQuery(atirgul40, "b-0501")).toBe(true);
  });
  it("katta-kichik harf farqi yo'q", () => {
    expect(batchMatchesQuery(prut40, "PRUT 40")).toBe(true);
  });
  it("ortiqcha bo'shliqlar zarar qilmaydi", () => {
    expect(batchMatchesQuery(prut40, "  prut   40  ")).toBe(true);
  });
  it("bo'sh so'rov → hammasi mos", () => {
    expect(batchMatchesQuery(prut40, "")).toBe(true);
    expect(batchMatchesQuery(prut40, "   ")).toBe(true);
  });
  it("mos kelmaydigan so'z butun natijani rad etadi (so'zlar orasida VA)", () => {
    expect(batchMatchesQuery(prut40, "prut 40 yoq")).toBe(false);
  });
  it("bo'y yo'q bo'lsa yiqilmaydi", () => {
    expect(batchMatchesQuery({ variant_detail: { flower_detail: { name_uz: "Prut" } } }, "prut")).toBe(true);
    expect(batchMatchesQuery({ variant_detail: { flower_detail: { name_uz: "Prut" } } }, "prut 40")).toBe(false);
  });
});

describe("compareCatalogNewestFirst — oxirgi qo'shilgan BIRINCHI", () => {
  it("yangi created_at oldinga", () => {
    const a = { id: 1, created_at: "2026-08-01T10:00:00+05:00" };
    const b = { id: 2, created_at: "2026-08-02T10:00:00+05:00" };
    expect([a, b].sort(compareCatalogNewestFirst).map((x) => x.id)).toEqual([2, 1]);
  });
  it("⚠️ BIR XIL created_at (orqaga sanalganlar 12:00 da) → id ↓ bilan BARQAROR", () => {
    const same = "2026-08-02T12:00:00+05:00";
    const rows = [
      { id: 147, created_at: same }, { id: 148, created_at: same }, { id: 146, created_at: same },
      { id: 145, created_at: same }, { id: 149, created_at: same },
    ];
    // jonli serverdan AYNAN shu aralash tartib kelgan edi
    expect(rows.slice().sort(compareCatalogNewestFirst).map((x) => x.id)).toEqual([149, 148, 147, 146, 145]);
  });
  it("qayta-qayta saralash tartibni O'ZGARTIRMAYDI (barqarorlik)", () => {
    const same = "2026-08-02T12:00:00+05:00";
    const rows = [{ id: 3, created_at: same }, { id: 1, created_at: same }, { id: 2, created_at: same }];
    const once = rows.slice().sort(compareCatalogNewestFirst).map((x) => x.id);
    const twice = rows.slice().sort(compareCatalogNewestFirst).sort(compareCatalogNewestFirst).map((x) => x.id);
    expect(once).toEqual([3, 2, 1]);
    expect(twice).toEqual(once);
  });
  it("created_at yo'q bo'lsa ham yiqilmaydi", () => {
    const rows = [{ id: 5 }, { id: 9 }];
    expect(rows.slice().sort(compareCatalogNewestFirst).map((x) => x.id)).toEqual([9, 5]);
  });
});
