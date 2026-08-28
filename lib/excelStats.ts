/**
 * EXCEL VARAQLARI — ustun turlarini aniqlash (sof mantiq, testlanadi).
 *
 * ⚠️ SOVDA varag'ida hamma son PUL EMAS: `sotuv: 30` yoki «kotta savat: 1»
 * DONA sonini bildiradi, ularni pul deb chizsak «30 so'm» bo'lib chiqadi.
 * Shu bois SOVDA da pul ustunlari ANIQ sanaladi; RASXOD/YANDEX varaqlarida
 * esa hamma son pul.
 */

export type ExcelSheet = "sovda" | "rasxod" | "yandex";

/** Matn ustunlari — katta/kichik harfga qaramaydi. */
const TEXT_COLS = new Set(["№", "sana", "date"]);

/**
 * SOVDA varag'idagi PUL ustunlari.
 * ⚠️ `terminal` va `boshqa` — backend 28.08.2026 da qo'shildi; ro'yxatga
 * kiritilmasa ular «dona» deb chizilib, terminal tushumi 250 000 o'rniga
 * «250 000» quruq son bo'lib ko'rinardi. `jami tushum` ham pul.
 */
export const SOVDA_MONEY_COLS = ["sovda", "naxt", "karta", "terminal", "boshqa", "dostavka", "jami tushum"];
const SOVDA_MONEY = new Set(SOVDA_MONEY_COLS);

export const isTextCol = (c: string): boolean => TEXT_COLS.has(c.trim().toLowerCase()) || c.trim() === "№";

export const isMoneyCol = (sheet: ExcelSheet, c: string): boolean =>
  sheet === "sovda" ? SOVDA_MONEY.has(c.trim().toLowerCase()) : true;

/**
 * Ustunlar HAMMA qatordan yig'iladi — birinchi qatorda bo'lmagan ustun tushib
 * qolmasin. ⚠️ Ro'yxat KODDA QOTIRILMAYDI: `rasxod` varag'ining ustunlari —
 * florist ismlari; yangi xodim qo'shilsa ustuni ham o'zidan paydo bo'lishi kerak.
 */
export const columnsOf = (rows: Record<string, unknown>[]): string[] => {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) for (const k of Object.keys(r ?? {})) if (!seen.has(k)) { seen.add(k); out.push(k); }
  return out;
};
