import { describe, it, expect } from "vitest";
import {
  decorationUnit, decorationBlocked, decorationTotal, decorationCheck,
  buildDecorationPayload, decorationOutcome, buildSalaryEditPayload,
  hasArithmetic, arithmeticLabel, isOwnProfile,
} from "./decoration";

const fl = (fee: string | null) => ({ decoration_fee: fee } as never);

describe("decorationUnit — «Boshqa narx» profildan USTUN", () => {
  it("override bo'lmasa profil narxi (jonli: Isroil 5000.00)", () => {
    expect(decorationUnit(fl("5000.00"), "")).toBe(5000);
  });
  it("override bo'lsa O'SHA ishlatiladi", () => {
    expect(decorationUnit(fl("5000.00"), "7000")).toBe(7000);
  });
  it("formatlangan override ham o'qiladi", () => {
    expect(decorationUnit(fl("5000.00"), "7 000")).toBe(7000);
  });
  it("profil narxi nol/bo'sh/yo'q", () => {
    for (const v of ["0.00", "", null]) expect(decorationUnit(fl(v), "")).toBe(0);
    expect(decorationUnit(null, "")).toBe(0);
  });
  it("⚠️ override «0» — bu ATAYLAB nol, profilga qaytmaydi", () => {
    expect(decorationUnit(fl("5000.00"), "0")).toBe(0);
  });
});

describe("⚠️ decorationBlocked — server 400 ini OLDINDAN tutish", () => {
  it("profil 0 va override yo'q → BLOKLANADI", () => {
    expect(decorationBlocked(fl("0.00"), "")).toBe(true);
    expect(decorationBlocked(fl(null), "")).toBe(true);
  });
  it("profil 0 lekin override bor → ochiq", () => {
    expect(decorationBlocked(fl("0.00"), "6000")).toBe(false);
  });
  it("profil narxi bor → ochiq", () => {
    expect(decorationBlocked(fl("5000.00"), "")).toBe(false);
  });
});

describe("decorationTotal / decorationCheck — JONLI hisob", () => {
  it("spec misoli: 3 × 5 000 = 15 000", () => {
    expect(decorationTotal(3, 5000)).toBe(15000);
  });
  it("override bilan qayta hisoblanadi", () => {
    const c = decorationCheck({ florist: fl("5000.00"), count: "2", override: "7000" });
    expect([c.count, c.unit, c.total, c.ok]).toEqual([2, 7000, 14000, true]);
  });
  it("count < 1 — bloklanadi va SABAB aytiladi", () => {
    for (const v of ["", "0", "-3", "abrakadabra"]) {
      const c = decorationCheck({ florist: fl("5000.00"), count: v, override: "" });
      expect(c.ok).toBe(false);
      expect(c.reason).toContain("kamida 1");
    }
  });
  it("narx yo'q — spec matni bilan bloklanadi", () => {
    const c = decorationCheck({ florist: fl("0.00"), count: "3", override: "" });
    expect(c.ok).toBe(false);
    expect(c.reason).toContain("Avval oformleniya narxini kiriting");
  });
  it("ok bo'lsa sabab BO'SH (invariant — zid holat bo'lmaydi)", () => {
    for (const [fee, count, ov] of [["5000", "1", ""], ["0", "2", "9000"], ["5000", "38", ""]] as const) {
      const c = decorationCheck({ florist: fl(fee), count, override: ov });
      expect(c.ok ? c.reason === "" : c.reason !== "").toBe(true);
    }
  });
});

describe("buildDecorationPayload — bo'sh maydon YUBORILMAYDI", () => {
  it("faqat count", () => {
    expect(buildDecorationPayload({ count: "3", workDate: "", override: "", note: "" })).toEqual({ count: 3 });
  });
  it("to'liq", () => {
    expect(buildDecorationPayload({ count: "3", workDate: "2026-08-07", override: "5000", note: "Kechki smena" }))
      .toEqual({ count: 3, work_date: "2026-08-07", unit_amount: "5000", note: "Kechki smena" });
  });
  it("⚠️ SANA — DATE, datetime EMAS", () => {
    expect(buildDecorationPayload({ count: "1", workDate: "2026-08-07T14:30", override: "", note: "" }).work_date)
      .toBe("2026-08-07");
  });
  it("⚠️ bo'sh `unit_amount` yuborilmaydi — aks holda profil narxi BEKOR bo'lardi", () => {
    const p = buildDecorationPayload({ count: "3", workDate: "", override: "   ", note: "  " });
    expect("unit_amount" in p).toBe(false);
    expect("note" in p).toBe(false);
  });
  it("count kamida 1 ga qisiladi", () => {
    expect(buildDecorationPayload({ count: "0", workDate: "", override: "", note: "" }).count).toBe(1);
  });
});

describe("⚠️ decorationOutcome — 200 (birlashdi) va 201 (yangi) FARQLANADI", () => {
  it("200 → birlashdi", () => {
    expect(decorationOutcome(200, { quantity: 5, amount: "25000.00" })).toContain("Bugungi qatorga qo'shildi: 5 ta");
  });
  it("201 → yangi qator", () => {
    expect(decorationOutcome(201, { quantity: 2, amount: "14000.00" })).toContain("Yangi qator qo'shildi: 2 ta");
  });
  it("ikkalasi HAR XIL matn beradi (operator farqni ko'rsin)", () => {
    const e = { quantity: 3, amount: "15000.00" };
    expect(decorationOutcome(200, e)).not.toBe(decorationOutcome(201, e));
  });
  it("javob bo'sh bo'lsa ham yiqilmaydi", () => {
    expect(decorationOutcome(201, null)).toContain("0 ta");
  });
});

describe("⚠️ buildSalaryEditPayload — UCH XULQ HECH QACHON ARALASHMAYDI", () => {
  const initial = { quantity: 3, unit_amount: "5000.00", amount: "15000.00" };

  it("calc: FAQAT quantity", () => {
    expect(buildSalaryEditPayload(initial, { quantity: "5", unitAmount: "5000", amount: "15000" }, "calc"))
      .toEqual({ quantity: 5 });
  });
  it("calc: FAQAT unit_amount", () => {
    expect(buildSalaryEditPayload(initial, { quantity: "3", unitAmount: "6000", amount: "15000" }, "calc"))
      .toEqual({ unit_amount: "6000" });
  });
  it("manual: FAQAT amount", () => {
    expect(buildSalaryEditPayload(initial, { quantity: "3", unitAmount: "5000", amount: "20000" }, "manual"))
      .toEqual({ amount: "20000" });
  });
  it("⚠️ `amount` HECH QACHON quantity/unit_amount bilan BIRGA chiqmaydi", () => {
    const cases: [typeof initial, { quantity: string; unitAmount: string; amount: string }, "calc" | "manual"][] = [
      [initial, { quantity: "9", unitAmount: "9000", amount: "99000" }, "calc"],
      [initial, { quantity: "9", unitAmount: "9000", amount: "99000" }, "manual"],
      [initial, { quantity: "3", unitAmount: "5000", amount: "1" }, "calc"],
    ];
    for (const [i, d, m] of cases) {
      const k = Object.keys(buildSalaryEditPayload(i, d, m));
      const hasAmount = k.includes("amount");
      const hasCalc = k.includes("quantity") || k.includes("unit_amount");
      expect(hasAmount && hasCalc).toBe(false);
    }
  });
  it("⚠️ O'ZGARMAGAN `amount` YUBORILMAYDI — aks holda hisob JIMGINA muzlab qolardi", () => {
    expect(buildSalaryEditPayload(initial, { quantity: "3", unitAmount: "5000", amount: "15000" }, "manual")).toEqual({});
  });
  it("hech narsa o'zgarmagan — BO'SH tana", () => {
    expect(buildSalaryEditPayload(initial, { quantity: "3", unitAmount: "5000", amount: "15000" }, "calc")).toEqual({});
  });
  it("ikkalasi ham o'zgarsa — ikkalasi ketadi, `amount` baribir YO'Q", () => {
    const p = buildSalaryEditPayload(initial, { quantity: "5", unitAmount: "6000", amount: "15000" }, "calc");
    expect(p).toEqual({ quantity: 5, unit_amount: "6000" });
    expect("amount" in p).toBe(false);
  });
});

describe("qatordagi hisob — BITTA shart, BITTA renderer", () => {
  it("extra_decoration: ikkalasi > 0 → hisob ko'rsatiladi", () => {
    expect(hasArithmetic({ quantity: 3, unit_amount: "5000.00" })).toBe(true);
    expect(arithmeticLabel({ quantity: 3, unit_amount: "5000.00" })).toBe("3 × 5 000");
  });
  it("boshqa manbalarda ikkalasi 0/yo'q → faqat summa", () => {
    for (const r of [{ quantity: 0, unit_amount: "0.00" }, { quantity: 3, unit_amount: "0" }, {}])
      expect(hasArithmetic(r)).toBe(false);
  });
});

describe("⚠️ isOwnProfile — florist O'ZIGA yoza olmaydi (server 403)", () => {
  it("florist.user === me.id → BU MEN", () => {
    expect(isOwnProfile({ user: 12 } as never, 12)).toBe(true);
  });
  it("boshqa florist", () => {
    expect(isOwnProfile({ user: 12 } as never, 7)).toBe(false);
  });
  it("noma'lum foydalanuvchi — «men» deb hisoblanmaydi", () => {
    expect(isOwnProfile({ user: 12 } as never, null)).toBe(false);
    expect(isOwnProfile(null, 12)).toBe(false);
  });
});
