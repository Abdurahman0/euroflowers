import type { CatalogItem } from "./types";

/**
 * MAXSUS KATALOGNI QAYTARISH — sof mantiq
 * (euroflowers_custom_catalog_return_frontend.md).
 *
 * ⚠️ SOTUVNI QAYTARISH EMAS. Sotilgan katalog uchun `restore-sale/` bor;
 * bu esa xato qo'shilgan yoki mijoz bekor qilgan MAXSUS katalogni butunlay
 * bekor qiladi: gul/material skladga qaytadi, florist oyligi olib tashlanadi,
 * katalog yozuvining O'ZI o'chadi.
 */

export type CustomReturnResponse = {
  detail: string;
  returned_catalog?: {
    id: number;
    catalog?: string;
    catalog_kind?: string;
    arrangement_type?: string;
    volume?: string | null;
    price?: string;
    quantity_total?: number;
    quantity_stock_deducted?: number;
    status?: string;
    reason?: string;
  };
};

/**
 * Tugma KO'RSATILADIMI — spec'dagi shart AYNAN:
 *   custom · sotilmagan · chiqitga chiqarilmagan · restavratsiya qilinmagan.
 * ⚠️ Maydon kelmasa 0 deb olinadi (eski javoblarda bo'lmasligi mumkin).
 */
export function canReturnCustom(item: Pick<CatalogItem, "catalog_kind" | "quantity_sold" | "quantity_wasted" | "quantity_reworked"> | null | undefined): boolean {
  if (!item || item.catalog_kind !== "custom") return false;
  return (item.quantity_sold ?? 0) === 0
    && (item.quantity_wasted ?? 0) === 0
    && (item.quantity_reworked ?? 0) === 0;
}

/** Tana — `reason` IXTIYORIY: bo'sh bo'lsa kalit umuman yuborilmaydi. */
export function customReturnPayload(reason?: string | null): Record<string, string> {
  const r = (reason ?? "").trim();
  return r ? { reason: r } : {};
}

/** Muvaffaqiyat matni — server bergani ustun, bo'lmasa spec'dagi ibora. */
export const customReturnMessage = (res: CustomReturnResponse | null | undefined): string =>
  (res?.detail ?? "").trim() || "Mahsus katalog qaytarildi";

/* ── spec'dagi AYNAN matnlar — bir joyda, ikki xil yozilib ketmasin ── */
export const RETURN_CUSTOM_LABEL = "Mahsus katalogni qaytarish";
export const RETURN_CUSTOM_CONFIRM =
  "Bu mahsus katalog qaytariladi. Yechilgan gullar va materiallar skladga qaytadi, katalog esa o'chiriladi. Davom etasizmi?";
export const RETURN_CUSTOM_REASON_PLACEHOLDER = "Sababini yozing";
