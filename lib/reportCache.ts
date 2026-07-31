"use client";
import { api } from "./api";
import type { Accounting, StockBatch } from "./types";

/**
 * Hisobot sahifalari uchun YAGONA MANBA + qisqa muddatli kesh.
 * Dashboard (alertlar) va Analitika (BatchSarfiPanel) bir xil `stock-batches`ni,
 * Hisob-kitob va Analitika (eksport) bir xil `accounting`ni so'raydi — takroriy
 * tarmoq so'rovlarini yo'qotish uchun natija TTL davomida keshlanadi va
 * bir vaqtda ketayotgan so'rovlar bitta promise'ga birlashtiriladi (in-flight dedupe).
 * Ma'lumot o'zgarganда `invalidateReportCache()` chaqiriladi (ef:stock-changed va h.k.).
 */
const TTL = 30_000; // 30s — "bugun nima bo'lyapti" uchun yetarlicha yangi
type Entry = { at: number; p: Promise<unknown> };
const cache = new Map<string, Entry>();

function cached<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.p as Promise<T>;
  const p = fetcher().catch((e) => { cache.delete(key); throw e; }); // xato keshlanmaydi
  cache.set(key, { at: Date.now(), p });
  return p as Promise<T>;
}

/** Barcha faol sklad partiyalari (paginatsiya API qatlamida yig'iladi). */
export const stockBatchesCached = (): Promise<StockBatch[]> =>
  cached("stock-batches:active", () => api.stockBatches({ is_active: true, page_size: 100 }));

/** Davr hisob-kitobi (inklyuziv `to`) — kalit sana + FILIAL bo'yicha (branch keshga kiradi). */
export const accountingCached = (from?: string, to?: string, branch?: string): Promise<Accounting> =>
  cached(`accounting:${from ?? ""}:${to ?? ""}:${branch ?? "all"}`, () => api.accounting({ from, to, branch }));

/** Ma'lumot o'zgargach keshni tozalash (sotuv, chiqit, partiya tahriri). */
export const invalidateReportCache = () => cache.clear();

/**
 * Hisobot raqamlarini o'zgartiradigan HAR QANDAY mutatsiyadan keyin chaqiriladi
 * (sotuv, chegirmali sotuv, chiqit, sklad/material harakati, katalog CRUD, transfer,
 * florist chiqarish/qaytarish/chiqit/to'g'rilash, partiya/yuk CRUD).
 *
 * IKKALASINI ham bajaradi — chunki bittasi yetmaydi:
 *   1) invalidateReportCache() — keshni tozalaydi. MOUNT bo'lmagan hisobot sahifasi
 *      keyin ochilganda ham STALE (30s TTL) qiymat o'qimaydi. FAQAT event yuborish
 *      buni qoplamaydi: tinglovchining load()'i tozalanmagan keshni qaytaradi.
 *   2) ef:stock-changed — MOUNT bo'lgan hisobot sahifalari (Sklad, Hisob-kitob)
 *      darhol qayta yuklaydi. Kesh event YUBORILISHIDAN OLDIN tozalangani uchun
 *      tinglovchi yangi ma'lumot oladi.
 */
export const notifyReportDataChanged = () => {
  invalidateReportCache();
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent("ef:stock-changed"));
};
