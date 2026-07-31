import { exportWorkbook, exportName, type SheetCol, type SheetDef } from "./xlsx";
import { accountingRowView } from "./branch";
import type { AccountingByBranch, AccountingFigures } from "./types";

/**
 * Hisob-kitob bo'limlari uchun Excel eksport — har bo'limga alohida kitob,
 * hamda bitta "Barchasi" kitobi (har bo'lim = alohida varaq). Joriy davr/filtrlarga
 * bo'ysunadi (chaqiruvchi allaqachon filtrlangan qatorlarni beradi).
 */

export type SupplierRow = { name: string; purchase: number; paid: number | null; debt: number | null; revenue: number; profit: number; margin: number; wasteStems: number; wasteValue: number };
export type CatalogProfitRow = { name: string; kind: string; arrangement: string; volume: string; florist: string; soldAt: string; qty: number; sale: number; cost: number; discount: number; net: number; margin: number };
export type VariantRow = { name: string; purchasedStems: number; purchaseSum: number; soldStems: number; wasteStems: number; wasteValue: number; revenue: number; profit: number; margin: number };
export type FloristRow = { name: string; staffType: string; standard: number; custom: number; productionValue: number; salary: number; avgPerItem: number; totalProfit: number };
export type CostBreakdownRow = { label: string; amount: number; pct: number };

const sum = (rows: Record<string, unknown>[], key: string) => rows.reduce((t, r) => t + (Number(r[key]) || 0), 0);

const supplierCols: SheetCol[] = [
  { header: "Yetkazib beruvchi", key: "name", type: "text" },
  { header: "Xarid summasi", key: "purchase", type: "money" },
  { header: "To'langan", key: "paid", type: "money" },
  { header: "Qarz", key: "debt", type: "money" },
  { header: "Tushum", key: "revenue", type: "money" },
  { header: "Foyda", key: "profit", type: "money" },
  { header: "Marja %", key: "margin", type: "int" },
  { header: "Chiqit (dona)", key: "wasteStems", type: "int" },
  { header: "Chiqit summasi", key: "wasteValue", type: "money" },
];
export const supplierSheet = (rows: SupplierRow[]): SheetDef => ({
  name: "Yetkazib beruvchilar", cols: supplierCols, rows: rows as unknown as Record<string, unknown>[],
  totals: { name: "JAMI", purchase: sum(rows, "purchase"), paid: sum(rows, "paid"), debt: sum(rows, "debt"), revenue: sum(rows, "revenue"), profit: sum(rows, "profit"), wasteValue: sum(rows, "wasteValue") },
});

const catalogCols: SheetCol[] = [
  { header: "Nomi", key: "name", type: "text" },
  { header: "Turi", key: "arrangement", type: "text" },
  { header: "Hajmi", key: "volume", type: "text" },
  { header: "Florist", key: "florist", type: "text" },
  { header: "Sotilgan", key: "soldAt", type: "date" },
  { header: "Soni", key: "qty", type: "int" },
  { header: "Sotuv narxi", key: "sale", type: "money" },
  { header: "Tannarx", key: "cost", type: "money" },
  { header: "Chegirma", key: "discount", type: "money" },
  { header: "Sof foyda", key: "net", type: "money" },
  { header: "Marja %", key: "margin", type: "int" },
];
export const catalogSheet = (rows: CatalogProfitRow[]): SheetDef => ({
  name: "Katalog foydasi", cols: catalogCols, rows: rows as unknown as Record<string, unknown>[],
  totals: { name: "JAMI", qty: sum(rows, "qty"), sale: sum(rows, "sale"), cost: sum(rows, "cost"), discount: sum(rows, "discount"), net: sum(rows, "net") },
});

const variantCols: SheetCol[] = [
  { header: "Gul navi", key: "name", type: "text" },
  { header: "Xarid (dona)", key: "purchasedStems", type: "int" },
  { header: "Xarid summasi", key: "purchaseSum", type: "money" },
  { header: "Sotuvga (dona)", key: "soldStems", type: "int" },
  { header: "Chiqit (dona)", key: "wasteStems", type: "int" },
  { header: "Chiqit summasi", key: "wasteValue", type: "money" },
  { header: "Tushum", key: "revenue", type: "money" },
  { header: "Sof foyda", key: "profit", type: "money" },
  { header: "Marja %", key: "margin", type: "int" },
];
export const variantSheet = (rows: VariantRow[]): SheetDef => ({
  name: "Gul turlari", cols: variantCols, rows: rows as unknown as Record<string, unknown>[],
  totals: { name: "JAMI", purchasedStems: sum(rows, "purchasedStems"), purchaseSum: sum(rows, "purchaseSum"), soldStems: sum(rows, "soldStems"), wasteValue: sum(rows, "wasteValue"), revenue: sum(rows, "revenue"), profit: sum(rows, "profit") },
});

const floristCols: SheetCol[] = [
  { header: "Florist", key: "name", type: "text" },
  { header: "Turi", key: "staffType", type: "text" },
  { header: "Standart", key: "standard", type: "int" },
  { header: "Maxsus", key: "custom", type: "int" },
  { header: "Ishlab chiqarish qiymati", key: "productionValue", type: "money" },
  { header: "Oylik", key: "salary", type: "money" },
  { header: "O'rtacha (1 mahsulot)", key: "avgPerItem", type: "money" },
  { header: "Mahsulot foydasi", key: "totalProfit", type: "money" },
];
export const floristSheet = (rows: FloristRow[]): SheetDef => ({
  name: "Floristlar", cols: floristCols, rows: rows as unknown as Record<string, unknown>[],
  totals: { name: "JAMI", standard: sum(rows, "standard"), custom: sum(rows, "custom"), productionValue: sum(rows, "productionValue"), salary: sum(rows, "salary"), totalProfit: sum(rows, "totalProfit") },
});

const breakdownCols: SheetCol[] = [
  { header: "Modda", key: "label", type: "text" },
  { header: "Summa", key: "amount", type: "money" },
  { header: "Ulush %", key: "pct", type: "int" },
];
export const breakdownSheet = (rows: CostBreakdownRow[]): SheetDef => ({ name: "Xarajatlar taqsimoti", cols: breakdownCols, rows: rows as unknown as Record<string, unknown>[] });

/** FILIALLAR varag'i — by_branch + summary (Jami). Ekran bilan bir xil ma'lumot
    (klient by_branch'dan), shu bois eksport doim ekranga mos keladi. */
const branchCols: SheetCol[] = [
  { header: "Filial", key: "filial", type: "text" }, { header: "Sotuv", key: "sotuv", type: "int" },
  { header: "Buket", key: "buket", type: "int" }, { header: "Gul donasi", key: "stems", type: "int" },
  { header: "Savdo", key: "savdo", type: "money" }, { header: "Naqd", key: "naqd", type: "money" },
  { header: "Karta", key: "karta", type: "money" }, { header: "Skidka", key: "skidka", type: "money" },
  { header: "Tannarx", key: "tannarx", type: "money" }, { header: "Sof foyda", key: "foyda", type: "money" },
  { header: "Ulush %", key: "ulush", type: "text" },
];
export const branchSheet = (rows: AccountingByBranch[], summary: AccountingFigures): SheetDef => {
  const toRow = (f: AccountingFigures, jami = false) => { const v = accountingRowView(f); return { filial: jami ? "Jami" : v.name, sotuv: v.salesCount, buket: v.buket, stems: v.stems, savdo: v.sales, naqd: v.cash, karta: v.card, skidka: v.discount, tannarx: v.cost, foyda: v.net, ulush: `${v.share}%` }; };
  return { name: "Filiallar", cols: branchCols, rows: rows.map((r) => toRow(r)), totals: toRow(summary, true) };
};

/** Bitta bo'limni alohida kitob qilib yuklab olish. */
export const exportSection = (label: string, sheet: SheetDef, from?: string, to?: string) =>
  exportWorkbook(exportName(`Hisob-kitob_${label}`, from, to), [sheet]);

/** Barcha bo'limlar — bitta kitob. `branchLabel` fayl nomiga (filial + davr aniq bo'lsin). */
export const exportAll = (sheets: SheetDef[], from?: string, to?: string, branchLabel?: string) =>
  exportWorkbook(exportName(`Hisob-kitob_Barchasi${branchLabel ? `_${branchLabel}` : ""}`, from, to), sheets);
