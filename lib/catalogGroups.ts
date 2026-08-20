import { catalogRemaining } from "@/lib/rework";
import { VOLUME_LABEL } from "@/lib/inventory";
import type { ArrangementType, CatalogItem, CatalogVolume } from "@/lib/types";

/**
 * KATALOGNI HAJM + TUR bo'yicha guruhlash — ro'yxat «umumiy» ko'rinishda chiziladi:
 * bitta karta = bitta hajm va bitta tur («Kichik buket», «Kichik savat»…).
 *
 * ⚠️ NEGA HAJM: do'konda bir xil tovar bir necha marta kiritilgan («kotta»,
 *    «KOTTA 100 TALI ATIR», «kotta buket» — hammasi 800 000 so'm). Operator uchun
 *    ular BITTA tovar: «katta buket 15 ta bor». Qaysi yozuvdan yechilishi muhim emas.
 *
 * ⚠️ NEGA TUR: SAVAT buketdan ALOHIDA karta bo'lishi kerak — narxi ham, tayyorlanishi
 *    ham boshqa (jonli: o'rta savat 1 000 000, o'rta buket 400 000). Bir kartaga
 *    qo'shilsa qoldiq soni ham, narx ham chalkashardi.
 *
 * ⚠️ HAJMSIZ yozuvlar YO'QOLMAYDI — o'z guruhiga tushadi (`volume: ""`), aks holda
 *    sotiladigan tovar ekranda umuman ko'rinmay qolardi.
 *
 * ⚠️ Guruh FAQAT hozir ko'rinib turgan (filtr + sahifa) yozuvlardan yig'iladi —
 *    sonlar ro'yxat bilan bir xil bo'lishi uchun.
 */
export type CatalogGroup = {
  /** `${volume}|${type}` — React key va akkordeon holati uchun */
  key: string;
  volume: CatalogVolume | "";
  type: ArrangementType;
  /** ko'rinadigan sarlavha: «Kichik savat», «Hajmi belgilanmagan buket» */
  label: string;
  items: CatalogItem[];
  /** sotishga tayyor qoldiq (guruhdagi barcha pozitsiyalar yig'indisi) */
  remaining: number;
  total: number;
  sold: number;
  /** har xil narxlar (o'sish tartibida) — bitta bo'lsa kartada aniq narx chiqadi */
  prices: number[];
};

/** Hajm tartibi — kichikdan kattaga; hajmsizlar OXIRIDA. */
const VOLUME_ORDER: (CatalogVolume | "")[] = ["small", "medium", "large", ""];
/** Tur tartibi — buket, savat, quti. */
const TYPE_ORDER: ArrangementType[] = ["bouquet", "basket", "box"];
const TYPE_WORD: Record<ArrangementType, string> = { bouquet: "buket", basket: "savat", box: "quti" };

const volumeOf = (k: CatalogItem): CatalogVolume | "" => {
  const v = (k.volume ?? "").trim().toLowerCase();
  return v === "small" || v === "medium" || v === "large" ? v : "";
};
const typeOf = (k: CatalogItem): ArrangementType =>
  k.arrangement_type === "basket" || k.arrangement_type === "box" ? k.arrangement_type : "bouquet";

export const groupKey = (volume: CatalogVolume | "", type: ArrangementType) => `${volume}|${type}`;

export const groupLabel = (volume: CatalogVolume | "", type: ArrangementType) =>
  `${volume ? VOLUME_LABEL[volume] : "Hajmi belgilanmagan"} ${TYPE_WORD[type]}`;

export function groupCatalog(items: CatalogItem[]): CatalogGroup[] {
  const map = new Map<string, CatalogItem[]>();
  for (const k of items) {
    const key = groupKey(volumeOf(k), typeOf(k));
    const cur = map.get(key);
    if (cur) cur.push(k);
    else map.set(key, [k]);
  }
  const out: CatalogGroup[] = [];
  for (const volume of VOLUME_ORDER) {
    for (const type of TYPE_ORDER) {
      const key = groupKey(volume, type);
      const list = map.get(key);
      if (!list) continue;
      out.push({
        key,
        volume,
        type,
        label: groupLabel(volume, type),
        items: list,
        remaining: list.reduce((s, k) => s + catalogRemaining(k), 0),
        total: list.reduce((s, k) => s + (k.quantity_total ?? 1), 0),
        sold: list.reduce((s, k) => s + (k.quantity_sold ?? 0), 0),
        // ⚠️ FAQAT qoldig'i bor pozitsiyalarning narxi — sotilib bo'lgan eski yozuv
        //    narx oralig'ini yolg'on kengaytirmasin.
        prices: Array.from(new Set(list.filter((k) => catalogRemaining(k) > 0).map((k) => Math.round(+(k.price ?? 0))))).sort((a, b) => a - b),
      });
    }
  }
  return out;
}


/**
 * KO'RINISH BO'LINISHI — BUKETLAR guruhlanadi, SAVAT/QUTI esa alohida kartada.
 *
 * ⚠️ Savat har biri o'ziga xos tovar (narxi ham, ko'rinishi ham har xil), shuning
 *    uchun u guruhga yig'ilmaydi — surati bilan alohida karta bo'lib chiqadi.
 *    Buket esa aksincha: bir xil tovar bir necha marta kiritilgan, hajm bo'yicha
 *    bitta karta yetarli («Katta buket 15 ta»).
 *
 * Savatlar tartibi: hajm bo'yicha (kichik → o'rta → katta → hajmsiz), ichida yangisi oldinda.
 */
export function splitCatalogView(items: CatalogItem[]): { groups: CatalogGroup[]; singles: CatalogItem[]; customs: CatalogItem[] } {
  // ⚠️ MAXSUS (custom) katalog HECH QACHON guruhga qo'shilmaydi — u mijoz uchun bir marta
  //    yasalgan buyum, o'z kartasi bilan «Maxsus katalog» bo'limida turadi.
  const isCustom = (k: CatalogItem) => k.catalog_kind === "custom";
  const rank = (k: CatalogItem) => VOLUME_ORDER.indexOf(volumeOf(k));
  const bySize = (a: CatalogItem, b: CatalogItem) => rank(a) - rank(b) || b.id - a.id;
  const std = items.filter((k) => !isCustom(k));
  return {
    groups: groupCatalog(std.filter((k) => typeOf(k) === "bouquet")),
    singles: std.filter((k) => typeOf(k) !== "bouquet").sort(bySize),
    customs: items.filter(isCustom).sort(bySize),
  };
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

/** Guruhda narx bitta bo'lsa — o'sha; har xil bo'lsa null (kartada oraliq chiqadi).
    ⚠️ Sotishni BLOKLAMAYDI: narx sotuv oynasida qo'lda kiritiladi. */
export const uniformPrice = (g: CatalogGroup): number | null => (g.prices.length === 1 ? g.prices[0] : null);
