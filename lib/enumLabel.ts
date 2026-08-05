/**
 * NOMA'LUM ENUM QIYMATI — YAGONA ishlov.
 *
 * ⚠️ Backend enum'lari O'SIB BORADI (`rework` — oxirgi misol). Ilgari har joyda
 * `LABEL[v] ?? v` yozilardi: ekranda XOM satr (`sale_decoration`) chiqib ketardi,
 * jurnalda esa yorliq UMUMAN ko'rinmasdi va HECH KIM sezmasdi. Endi:
 *   • foydalanuvchi O'QILADIGAN matn ko'radi (xom snake_case emas),
 *   • dasturchi konsolda BIR MARTA ogohlantirish oladi — keyingisi sezilmay qolmaydi.
 */

const warned = new Set<string>();

/** Bir xil noma'lum qiymat uchun konsol BIR MARTA ogohlantiradi (spam bo'lmasin). */
export function warnUnknownEnum(kind: string, value: string): void {
  const key = `${kind}:${value}`;
  if (warned.has(key)) return;
  warned.add(key);
  if (typeof console !== "undefined") {
    console.warn(`[enum] noma'lum ${kind}: "${value}" — yorliq qo'shilmagan (lib/inventory.ts / lib/format.ts). Backend yangi qiymat qo'shgan bo'lishi mumkin.`);
  }
}

/** `snake_case` → «Snake case» — yorliq yo'q bo'lganda o'qiladigan zaxira. */
export const humanizeEnum = (value: string): string => {
  const s = value.replace(/[_-]+/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : value;
};

/**
 * Yorliqni xaritadan oladi; yo'q bo'lsa — ogohlantiradi va o'qiladigan zaxira beradi.
 * ⚠️ `undefined`/bo'sh qiymat ogohlantirmaydi (bu «yo'q», «noma'lum» emas).
 */
export function enumLabel(map: Record<string, string>, value: string | null | undefined, kind: string): string {
  if (!value) return "—";
  const hit = map[value];
  if (hit) return hit;
  warnUnknownEnum(kind, value);
  return humanizeEnum(value);
}
