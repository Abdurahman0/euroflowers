import { describe, it, expect } from "vitest";
import { unitOf, configFor, quantityDual, receivePreview, buildReceivePayload, receiveZeroCost } from "./materialUnit";

const piece = { unit: "piece" as const, units_per_bunch: 1, quantity: 100, cost_price: "5000" };
const gupka = { unit: "bunch" as const, units_per_bunch: 20, quantity: 0, cost_price: "0" };

describe("unitOf — birlik aniqlash", () => {
  it("bunch → bunch", () => expect(unitOf({ unit: "bunch" })).toBe("bunch"));
  it("piece → piece", () => expect(unitOf({ unit: "piece" })).toBe("piece"));
  it("yo'q/null → piece (backend default)", () => {
    expect(unitOf(null)).toBe("piece");
    expect(unitOf({ unit: null })).toBe("piece");
    expect(unitOf({})).toBe("piece");
  });
});

describe("configFor — forma konfiguratsiyasi", () => {
  it("piece: dona maydonlari, units_per_bunch talab qilmaydi", () => {
    const c = configFor({ unit: "piece" });
    expect(c.label).toBe("Dona");
    expect(c.needsUnitsPerBunch).toBe(false);
  });
  it("bunch: pochka maydonlari, units_per_bunch talab qiladi", () => {
    const c = configFor({ unit: "bunch" });
    expect(c.label).toBe("Pochka");
    expect(c.needsUnitsPerBunch).toBe(true);
  });
});

describe("quantityDual — qoldiqni ikki birlikda", () => {
  it("piece → faqat dona", () => expect(quantityDual(piece)).toBe("100 dona"));
  it("bunch → dona + pochka", () => expect(quantityDual({ ...gupka, quantity: 100 })).toBe("100 dona · 5 pochka"));
  it("butun bo'lmasa bir xona (yaxlitlab yolg'on ko'rsatmaymiz)", () =>
    expect(quantityDual({ ...gupka, quantity: 150 })).toBe("150 dona · 7.5 pochka"));
  it("units_per_bunch=1 → pochka ko'rsatilmaydi (ma'nosiz)", () =>
    expect(quantityDual({ unit: "bunch", units_per_bunch: 1, quantity: 40 })).toBe("40 dona"));
});

describe("receivePreview — DONA kirimi", () => {
  it("20 × 5 000 = 100 000", () => {
    const p = receivePreview(piece, "20", "5000");
    expect(p).toMatchObject({ ok: true, unit: "piece", quantity: 20, costPerPiece: 5000, total: 100000, newQuantity: 120 });
  });
  it("narx bo'sh → tannarx o'zgarmaydi (null), jami yo'q", () => {
    const p = receivePreview(piece, "20", "");
    expect(p).toMatchObject({ ok: true, costPerPiece: null, total: null, quantity: 20 });
  });
  it("0 yoki bo'sh son → bloklanadi", () => {
    expect(receivePreview(piece, "0", "5000").ok).toBe(false);
    expect(receivePreview(piece, "", "5000").ok).toBe(false);
  });
});

describe("receivePreview — POCHKA kirimi (spec misoli: 5 pochka, 60 000, upb 20)", () => {
  const p = receivePreview(gupka, "5", "60000");
  it("quantity = bunches × units_per_bunch = 100", () => expect(p).toMatchObject({ ok: true, quantity: 100 }));
  it("cost_price = cost_per_bunch ÷ units_per_bunch = 3 000", () => expect(p).toMatchObject({ costPerPiece: 3000 }));
  it("jami = 5 × 60 000 = 300 000", () => expect(p).toMatchObject({ total: 300000 }));
  it("derivatsiya qatorlari ko'rsatiladi", () => {
    // ⚠️ toLocaleString("ru") uzilmas probel (NBSP) ishlatadi — kutilganini ham SHU tarzda quramiz
    const n = (x: number) => x.toLocaleString("ru");
    expect(p.ok && p.lines).toEqual([`5 pochka × 20 = ${n(100)} dona`, `${n(60000)} ÷ 20 = ${n(3000)} so'm/dona`]);
  });
  it("narxsiz — faqat dona derivatsiyasi", () => {
    const q = receivePreview(gupka, "5", "");
    expect(q.ok && q.lines).toEqual(["5 pochka × 20 = 100 dona"]);
    expect(q).toMatchObject({ costPerPiece: null, total: null });
  });
});

describe("receivePreview — units_per_bunch yo'q bo'lsa TAXMIN QILMAYDI", () => {
  it("upb=0 → bloklanadi", () => {
    const p = receivePreview({ unit: "bunch", units_per_bunch: 0, quantity: 0 }, "5", "60000");
    expect(p.ok).toBe(false);
    expect(!p.ok && p.reason).toMatch(/units_per_bunch/);
  });
  it("upb=1 → bloklanadi (1 pochka = 1 dona shubhali)", () => {
    const p = receivePreview({ unit: "bunch", units_per_bunch: 1, quantity: 0 }, "5", "60000");
    expect(p.ok).toBe(false);
  });
});

describe("buildReceivePayload — server shakli", () => {
  it("piece → { quantity, cost_price }", () => {
    const r = buildReceivePayload({ packaging: 53, material: piece, qty: "20", cost: "5000", reason: "Yangi yuk" });
    expect(r).toEqual({ ok: true, req: { packaging: 53, quantity: 20, cost_price: "5000", reason: "Yangi yuk" } });
  });
  it("bunch → { bunches, cost_per_bunch } (dona/dona-narx YUBORILMAYDI — backend hisoblaydi)", () => {
    const r = buildReceivePayload({ packaging: 52, material: gupka, qty: "5", cost: "60000" });
    expect(r).toEqual({ ok: true, req: { packaging: 52, bunches: 5, cost_per_bunch: "60000" } });
  });
  it("narx bo'sh → narx kaliti umuman yuborilmaydi", () => {
    const r = buildReceivePayload({ packaging: 53, material: piece, qty: "20", cost: "" });
    expect(r).toEqual({ ok: true, req: { packaging: 53, quantity: 20 } });
  });
  it("narx \"0\" → YUBORILADI (0 ≠ bo'sh)", () => {
    const r = buildReceivePayload({ packaging: 53, material: piece, qty: "20", cost: "0" });
    expect(r.ok && r.req.cost_price).toBe("0");
  });
  it("material tanlanmagan → xato", () => {
    expect(buildReceivePayload({ packaging: 0, material: piece, qty: "20" }).ok).toBe(false);
  });
  it("upb yo'q bunch → xato (payload qurilmaydi)", () => {
    const r = buildReceivePayload({ packaging: 52, material: { unit: "bunch", units_per_bunch: 0, quantity: 0 }, qty: "5" });
    expect(r.ok).toBe(false);
  });
});

describe("receiveZeroCost — tannarx 0 ogohlantirishi", () => {
  it("\"0\" → true", () => expect(receiveZeroCost("0")).toBe(true));
  it("bo'sh → false (tannarx o'zgarmaydi)", () => expect(receiveZeroCost("")).toBe(false));
  it("null → false", () => expect(receiveZeroCost(null)).toBe(false));
  it("5000 → false", () => expect(receiveZeroCost("5000")).toBe(false));
});
