/**
 * KATALOG — SKLADDAN YECHILGANMI?
 *
 * ⚠️ NEGA ALOHIDA FAYL: bu hisob NOTO'G'RI bo'lsa operatorga «skladdan
 * kamaytirilmagan» deb YOLG'ON ogohlantirish chiqadi va u tugmani bosib
 * skladni IKKINCHI MARTA kamaytirib yuboradi. Ya'ni xato jimgina emas —
 * u haqiqiy gulni yo'q qiladi.
 *
 * ⚠️ ASOSIY TUZOQ — «MAYDON YO'Q» va «QIYMAT NOL» BIR XIL EMAS.
 * Jonli tekshiruv (2026-08-19):
 *     GET /api/catalog/          → `quantity_stock_deducted` va `stock_deducted_at`
 *                                  UMUMAN YO'Q (yengil serializer 17 ta maydonni tashlaydi)
 *     GET /api/catalog/{id}/     → ikkalasi ham BOR
 * Ilgari kod `item.quantity_stock_deducted ?? (item.stock_deducted_at ? sold : 0)`
 * deb o'qirdi. Ro'yxatda ikkala maydon ham `undefined` bo'lgani uchun natija 0
 * chiqib, `pending = sold` bo'lardi — 290 katalogdan 261 tasida «yechilmagan»
 * degan ogohlantirish turardi, holbuki detal endpoint ularning HAMMASI allaqachon
 * yechilganini ko'rsatardi (#539 sotilgan 4 / yechilgan 4, #523 10/10, ...).
 *
 * Shu bois: maydon KELMAGAN bo'lsa `known: false` — biz BILMAYMIZ va HECH NARSA
 * DA'VO QILMAYMIZ. Bilmagan holda buzadigan amalni taklif qilmaymiz.
 */

export type CatalogStockLike = {
  status?: string | null;
  quantity_total?: number | null;
  quantity_sold?: number | null;
  quantity_stock_deducted?: number | null;
  stock_deducted_at?: string | null;
};

export type DeductionState = {
  /** server bu maydonlarni YUBORDIMI (ro'yxat javobida yubormaydi) */
  known: boolean;
  sold: number;
  deducted: number;
  /** ⚠️ BILMAGANDA DOIM 0 — ogohlantirish shu bilan boshqariladi */
  pending: number;
};

export function deductionState(item: CatalogStockLike | null | undefined): DeductionState {
  const total = item?.quantity_total ?? 1;
  const sold = item?.quantity_sold ?? (item?.status === "sold" ? total : 0);

  // ⚠️ `!== undefined` — `?? ` EMAS. `null` haqiqiy qiymat («hech qachon yechilmagan»),
  // `undefined` esa «server aytmadi». Ikkisini aralashtirish aynan shu nosozlikni bergan.
  if (item?.quantity_stock_deducted !== undefined && item?.quantity_stock_deducted !== null) {
    const deducted = item.quantity_stock_deducted;
    return { known: true, sold, deducted, pending: Math.max(sold - deducted, 0) };
  }
  if (item?.stock_deducted_at !== undefined) {
    // eski shakl: aniq son yo'q, faqat sana bor/yo'q
    const deducted = item.stock_deducted_at ? sold : 0;
    return { known: true, sold, deducted, pending: Math.max(sold - deducted, 0) };
  }
  return { known: false, sold, deducted: 0, pending: 0 };
}

/**
 * «Skladdan kamaytirish» taklifini KO'RSATISH KERAKMI.
 * ⚠️ Faqat ANIQ bilganda va haqiqatan yechilmagan bo'lsa. Bilmasak — jim turamiz:
 * ortiqcha kamaytirish qaytarib bo'lmaydigan zarar.
 */
export const shouldOfferDeduct = (item: CatalogStockLike | null | undefined): boolean => {
  const d = deductionState(item);
  return d.known && d.pending > 0;
};
