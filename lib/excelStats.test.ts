import { describe, it, expect } from "vitest";
import { columnsOf, isMoneyCol, isTextCol, SOVDA_MONEY_COLS } from "./excelStats";

/**
 * EXCEL JADVALLARI — ustun turlari (components/ExcelStatsTables.tsx shu moduldan
 * foydalanadi; ilgari qoidalar test ichida NUSXA qilingan edi).
 *
 * ⚠️ NEGA SINALADI: SOVDA varag'ida hamma son PUL EMAS. Ekranda «30 so'm» deb
 * chiqqan edi, aslida u 30 TA SOTUV. Operator sotuv sonini pul deb o'qishi
 * jimgina va xavfli xato.
 */

describe("⚠️ SOVDA — pul va DONA ustunlari ajratiladi", () => {
  it("pul ustunlari", () => {
    for (const c of ["sovda", "naxt", "karta", "dostavka"]) expect(isMoneyCol("sovda", c)).toBe(true);
  });
  it("⚠️ DONA ustunlari pul EMAS — «30 so'm» chiqmaydi", () => {
    for (const c of ["sotuv", "kotta savat", "sredni savat", "kickina savat", "kotta buket", "sred buket", "kich buket", "oyincho", "shokolad", "zapiska", "kitob", "banketka"]) {
      expect(isMoneyCol("sovda", c)).toBe(false);
    }
  });
  it("jonli qator bilan tekshirish: naxt+karta+dostavka ≈ sovda, `sotuv` esa alohida", () => {
    const row = { sovda: 8600000, naxt: 2750000, karta: 5700000, dostavka: 100000, sotuv: 30 };
    expect(row.naxt + row.karta + row.dostavka).toBeLessThanOrEqual(row.sovda);
    expect(isMoneyCol("sovda", "sotuv")).toBe(false); // 30 — dona, pul emas
  });
});

/* ===== TERMINAL — backend 28.08.2026 ===== */

describe("⚠️ SOVDA — terminal / boshqa / jami tushum PUL ustuni", () => {
  it("yangi ustunlar pul deb chiziladi", () => {
    // ro'yxatga kirmasa 4 250 000 «so'm»siz quruq son bo'lib ko'rinardi
    for (const c of ["terminal", "boshqa", "jami tushum"]) expect(isMoneyCol("sovda", c)).toBe(true);
  });
  it("jonli ustun nomlari bilan mos (GET /api/dashboard/ → excel_stats.sovda)", () => {
    const live = ["№", "sana", "sovda", "naxt", "karta", "terminal", "boshqa", "dostavka", "jami tushum", "sotuv", "kotta savat"];
    const money = live.filter((c) => !isTextCol(c) && isMoneyCol("sovda", c));
    expect(money).toEqual(["sovda", "naxt", "karta", "terminal", "boshqa", "dostavka", "jami tushum"]);
    expect(SOVDA_MONEY_COLS).toContain("terminal");
  });
  it("katta/kichik harf va bo'shliq muhim emas", () => {
    expect(isMoneyCol("sovda", " TERMINAL ")).toBe(true);
  });
});

describe("RASXOD / YANDEX — hamma son pul", () => {
  it("rasxod ustunlari (florist ismlari ham) pul", () => {
    for (const c of ["RASXOD", "OBED DEN", "ABO", "BEGZOD", "LENTA", "nalog"]) expect(isMoneyCol("rasxod", c)).toBe(true);
  });
  it("yandex yo'nalishlari pul", () => {
    for (const c of ["DOV", "KIYM", "XAYRULLO", "GUL", "VODIY"]) expect(isMoneyCol("yandex", c)).toBe(true);
  });
});

describe("matn ustunlari", () => {
  it("№ va sana — formatlanmaydi", () => {
    expect(isTextCol("№")).toBe(true);
    expect(isTextCol("sana")).toBe(true);
    expect(isTextCol("SANA")).toBe(true);
    expect(isTextCol("sovda")).toBe(false);
  });
});

describe("⚠️ USTUNLAR QATORLARDAN — kodda qotirilmaydi", () => {
  it("rasxodda florist ismi ustun bo'ladi va u ro'yxatga tushadi", () => {
    // yangi xodim qo'shilsa ustun ham qo'shiladi — kodda ro'yxat bo'lsa ko'rinmay qolardi
    const rows = [{ "№": 1, SANA: "2026-08-01", RASXOD: 5 }, { "№": 2, SANA: "2026-08-02", RASXOD: 7, YANGI_XODIM: 900 }];
    expect(columnsOf(rows)).toEqual(["№", "SANA", "RASXOD", "YANGI_XODIM"]);
  });
  it("bo'sh/buzuq qatorlar yiqitmaydi", () => {
    expect(columnsOf([])).toEqual([]);
    expect(columnsOf([null as never, { a: 1 }])).toEqual(["a"]);
  });
});
