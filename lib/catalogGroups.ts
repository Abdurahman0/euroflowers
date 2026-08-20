import { catalogRemaining } from "@/lib/rework";
import type { CatalogItem, CatalogVolume } from "@/lib/types";

/**
 * KATALOGNI HAJM BO'YICHA GURUHLASH — ro'yxat «umumiy» ko'rinishda chiziladi:
 * bitta karta = bitta hajm (Kichik / O'rta / Katta), ichida shu hajmdagi BARCHA
 * pozitsiyalar.
 *
 * ⚠️ NEGA: do'konda bir xil mahsulot bir necha marta kiritilgan («kotta»,
 *    «KOTTA 100 TALI ATIR», «kotta buket» — hammasi 800 000 so'm). Operator uchun
 *    ular BITTA tovar: «katta buket 15 ta bor». Qaysi yozuvdan yechilishi muhim emas.
 *
 * ⚠️ HAJMSIZ yozuvlar YO'QOLMAYDI — alohida guruhga tushadi (`volume: ""`),
 *    aks holda sotiladigan tovar ekranda umuman ko'rinmay qolardi.
 *
 * ⚠️ Guruh FAQAT hozir ko'rinib turgan (filtr + sahifa) yozuvlardan yig'iladi —
 *    sonlar ro'yxat bilan bir xil bo'lishi uchun.
 */
export type CatalogGroup = {
  volume: CatalogVolume | "";
  items: CatalogItem[];
  /** sotishga tayyor qoldiq (barcha pozitsiyalar yig'indisi) */
  remaining: number;
  total: number;
  sold: number;
  /** har xil narxlar (o'sish tartibida) — bitta bo'lsa kartada aniq narx chiqadi */
  prices: number[];
  /** tur bo'yicha pozitsiyalar soni — «6 buket · 2 savat» satri uchun */
  typeCounts: { bouquet: number; basket: number; box: number };
};

/** Ko'rsatiladigan tartib — kichikdan kattaga; hajmsizlar OXIRIDA. */
const ORDER: (CatalogVolume | "")[] = ["small", "medium", "large", ""];

const volumeOf = (k: CatalogItem): CatalogVolume | "" => {
  const v = (k.volume ?? "").trim().toLowerCase();
  return v === "small" || v === "medium" || v === "large" ? v : "";
};

export function groupByVolume(items: CatalogItem[]): CatalogGroup[] {
  const map = new Map<CatalogVolume | "", CatalogItem[]>();
  for (const k of items) {
    const v = volumeOf(k);
    const cur = map.get(v);
    if (cur) cur.push(k);
    else map.set(v, [k]);
  }
  return ORDER.filter((v) => map.has(v)).map((volume) => {
    const list = map.get(volume) ?? [];
    const typeCounts = { bouquet: 0, basket: 0, box: 0 };
    for (const k of list) {
      if (k.arrangement_type === "basket") typeCounts.basket++;
      else if (k.arrangement_type === "box") typeCounts.box++;
      else typeCounts.bouquet++;
    }
    return {
      volume,
      items: list,
      remaining: list.reduce((s, k) => s + catalogRemaining(k), 0),
      total: list.reduce((s, k) => s + (k.quantity_total ?? 1), 0),
      sold: list.reduce((s, k) => s + (k.quantity_sold ?? 0), 0),
      // ⚠️ FAQAT qoldig'i bor pozitsiyalarning narxi — sotilib bo'lgan eski yozuv
      //    narx oralig'ini yolg'on kengaytirmasin.
      prices: Array.from(new Set(list.filter((k) => catalogRemaining(k) > 0).map((k) => Math.round(+(k.price ?? 0))))).sort((a, b) => a - b),
      typeCounts,
    };
  });
}

/**
 * Guruhdan SOTILADIGAN pozitsiyani tanlaydi («qaysi biridan yechilishi muhim emas»).
 * Qoldig'i ENG KO'P pozitsiya olinadi — bitta yozuv oxirigacha sotilib, yarim ochiq
 * yozuvlar ko'paymaydi. Teng bo'lsa ESKISI (kichik id) birinchi ketadi.
 * Qoldig'i bor pozitsiya bo'lmasa — null.
 */
export function pickSellItem(items: CatalogItem[]): CatalogItem | null {
  const usable = items.filter((k) => catalogRemaining(k) > 0);
  if (!usable.length) return null;
  return usable.reduce((best, k) => {
    const d = catalogRemaining(k) - catalogRemaining(best);
    if (d > 0) return k;
    if (d === 0 && k.id < best.id) return k;
    return best;
  }, usable[0]);
}

/** Guruhda narx bitta bo'lsa — o'sha; har xil bo'lsa null (kartada oraliq chiqadi). */
export const uniformPrice = (g: CatalogGroup): number | null => (g.prices.length === 1 ? g.prices[0] : null);
