import { describe, it, expect } from "vitest";

/**
 * EXCEL JADVALLARI — ustun turlari (components/ExcelStatsTables.tsx mantiqi).
 *
 * ⚠️ NEGA SINALADI: SOVDA varag'ida hamma son PUL EMAS. Ekranda «30 so'm» deb
 * chiqqan edi, aslida u 30 TA SOTUV. Operator sotuv sonini pul deb o'qishi
 * jimgina va xavfli xato.
 */

// komponentdagi qoidalarning nusxasi (sof mantiq — shu yerda qulflanadi)
const SOVDA_MONEY = new Set(["sovda", "naxt", "karta", "dostavka"]);
const isMoney = (sheet: "sovda" | "rasxod" | "yandex", c: string) =>
  sheet === "sovda" ? SOVDA_MONEY.has(c.trim().toLowerCase()) : true;
const TEXT = new Set(["№", "sana", "date"]);
const isText = (c: string) => TEXT.has(c.trim().toLowerCase()) || c.trim() === "№";

/** Ustunlar HAMMA qatordan yig'iladi (birinchi qatorda yo'q ustun tushib qolmasin). */
const columnsOf = (rows: Record<string, unknown>[]): string[] => {
  const out: string[] = []; const seen = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r ?? {})) if (!seen.has(k)) { seen.add(k); out.push(k); }
  return out;
};

describe("⚠️ SOVDA — pul va DONA ustunlari ajratiladi", () => {
  it("pul ustunlari", () => {
    for (const c of ["sovda", "naxt", "karta", "dostavka"]) expect(isMoney("sovda", c)).toBe(true);
  });
  it("⚠️ DONA ustunlari pul EMAS — «30 so'm» chiqmaydi", () => {
    for (const c of ["sotuv", "kotta savat", "sredni savat", "kickina savat", "kotta buket", "sred buket", "kich buket", "oyincho", "shokolad", "zapiska", "kitob", "banketka"]) {
      expect(isMoney("sovda", c)).toBe(false);
    }
  });
  it("jonli qator bilan tekshirish: naxt+karta+dostavka ≈ sovda, `sotuv` esa alohida", () => {
    const row = { sovda: 8600000, naxt: 2750000, karta: 5700000, dostavka: 100000, sotuv: 30 };
    expect(row.naxt + row.karta + row.dostavka).toBeLessThanOrEqual(row.sovda);
    expect(isMoney("sovda", "sotuv")).toBe(false);   // 30 — dona, pul emas
  });
});

describe("RASXOD / YANDEX — hamma son pul", () => {
  it("rasxod ustunlari (florist ismlari ham) pul", () => {
    for (const c of ["RASXOD", "OBED DEN", "ABO", "BEGZOD", "LENTA", "nalog"]) expect(isMoney("rasxod", c)).toBe(true);
  });
  it("yandex yo'nalishlari pul", () => {
    for (const c of ["DOV", "KIYM", "XAYRULLO", "GUL", "VODIY"]) expect(isMoney("yandex", c)).toBe(true);
  });
});

describe("matn ustunlari", () => {
  it("№ va sana — formatlanmaydi", () => {
    expect(isText("№")).toBe(true);
    expect(isText("sana")).toBe(true);
    expect(isText("SANA")).toBe(true);
    expect(isText("sovda")).toBe(false);
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
