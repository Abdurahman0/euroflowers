import type { ArrangementType, BatchUsage, CatalogKind, CatalogVolume, FloristStockIssueKind, FloristVolumeRate, MovementType, PackagingType, RoundingSide, SalarySource, StaffType, StockBatch, StockDelivery, VolumeRateInput } from "./types";

/**
 * Sklad/florist bo'limlari uchun MARKAZLASHGAN o'zbekcha yorliqlar,
 * formatlagichlar va operatsion belgilar (freshness, stem gauge).
 * Barcha ranglar TEMA TOKENLARIDA — qattiq rang yo'q.
 */

/* ===== formatlash ===== */
const groups = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
/** "120 dona" */
export const stems = (n: number | string | null | undefined): string => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  return v == null || Number.isNaN(v) ? "—" : `${groups(v)} dona`;
};
/** "6 pochka" (o'nlik bo'lsa .00 tashlanadi) */
export const bunches = (n: number | string | null | undefined): string => {
  const v = typeof n === "string" ? parseFloat(n) : n;
  if (v == null || Number.isNaN(v)) return "—";
  const s = Number.isInteger(v) ? String(v) : v.toFixed(2).replace(/\.?0+$/, "");
  return `${s} pochka`;
};

/**
 * IKKI BIRLIKDA — "340 dona · 13.6 pochka". Pochka = dona / pochkadagi dona
 * (1-2 xona, ortiqcha nol tashlanadi). Butun ilova bo'ylab BITTA joydan
 * (batch gauge, harakatlar jurnali, kompozitsiya qoldiq maslahatlari, chiqit
 * oynasi) — birliklar bir xil ko'rinishi uchun.
 */
export const formatStemsAndBunches = (
  stemCount: number | string | null | undefined,
  stemsPerBunch: number | null | undefined
): string => {
  const v = typeof stemCount === "string" ? parseFloat(stemCount) : stemCount;
  if (v == null || Number.isNaN(v)) return "—";
  if (!stemsPerBunch || stemsPerBunch <= 0) return stems(v);
  return `${stems(v)} · ${bunches(v / stemsPerBunch)}`;
};

/* ===== YUK (delivery) — MARKAZLASHGAN o'zbekcha yorliqlar =====
   ⚠️ "Partiya" = StockBatch (backend xatolari ham shunday ataydi) — o'zgarmaydi.
   Yuk = partiyalarni guruhlaydigan yozuv. Yorliqlar SHU YERDA, literal sifatida sochilmaydi.
   ⚠️ Yuk `number` TAKRORLANADI — yorliqda DOIM sana bilan birga ko'rsatiladi (ikki "7" ni ajratish). */
/* ===== FLORIST KATALOGI — gul tanlanadi, soni chiqim yopilganda hisoblanadi =====
   ⚠️ Backend bu oqimni IKKI marta o'zgartirdi. Sof mantiq SHU YERDA markazlashgan
   (komponentlar inline emas) — keyingi o'zgarish kichik tahrir bo'lsin. */

/** Florist katalogi kompozitsiyasi — FAQAT gul (stock_batch). `quantity_stems` YUBORILMAYDI:
    u 0 bo'lib turadi va chiqim yopilganda hisoblanadi (spec). Bir xil batch takrorlanmaydi. */
export const buildFloristComposition = (batchIds: number[]): { stock_batch: number }[] =>
  batchIds.filter((id, i, arr) => id > 0 && arr.indexOf(id) === i).map((id) => ({ stock_batch: id }));

/** «Chiqim yopilishini kutayapti» — florist katalogi, gul tanlangan lekin soni hali 0.
    Spec: composition.some(row => quantity_stems === 0). ESKI bo'sh-kompozitsiyali florist
    itemlarni ham qamraydi (comp.length === 0). Operator (floristsiz) katalogi HECH QACHON waiting emas. */
export const catalogWaiting = (item: { florist?: number | null; composition?: ({ quantity_stems?: number } | null)[] | null }): boolean => {
  if (!item.florist) return false;
  const comp = item.composition ?? [];
  return comp.length === 0 || comp.some((c) => ((c?.quantity_stems ?? 0) === 0));
};

/** Florist katalogi YOPILGANMI — hamma qatorda soni > 0 (qisman to'lgani hali kutayapti). */
export const catalogClosed = (item: { florist?: number | null; composition?: ({ quantity_stems?: number } | null)[] | null }): boolean =>
  !!item.florist && (item.composition?.length ?? 0) > 0 && (item.composition ?? []).every((c) => ((c?.quantity_stems ?? 0) > 0));

export const DELIVERY = {
  one: "Yuk",
  many: "Yuklar",
  neu: "Yangi yuk",
  addFlower: "Gul qo'shish",
  colNumber: "Yuk",
  supplierWord: "Postavshik",
  /** "Yuk 7 · 01.08.2026" */
  label: (number: string, dateLabel: string) => `Yuk ${number} · ${dateLabel}`,
  /** "Yuk 7 · 01.08.2026 · Golland Flowers" (detalь/read-only satr) */
  labelFull: (number: string, dateLabel: string, supplier?: string | null) =>
    `Yuk ${number} · ${dateLabel}${supplier ? ` · ${supplier}` : ""}`,
} as const;

/** MATERIAL YUKI — markazlashgan yorliqlar. Gul "Yuk"idan ALOHIDA so'z ("Partiya" = StockBatch). */
export const MATERIAL_DELIVERY = {
  one: "Material yuki",
  many: "Material yuklari",
  neu: "Yangi material yuki",
  receive: "Material kiritish",
  colNumber: "Yuk",
  supplierWord: "Postavshik",
  lastSupplier: "Oxirgi postavshik",
  /** "Material yuki M-1 · 01.08.2026" */
  label: (number: string, dateLabel: string) => `Material yuki ${number} · ${dateLabel}`,
  labelFull: (number: string, dateLabel: string, supplier?: string | null) =>
    `Material yuki ${number} · ${dateLabel}${supplier ? ` · ${supplier}` : ""}`,
} as const;

/* ===== MATERIAL KIRITISH (receive) =====
   ⚠️ KO'CHIRILDI → lib/materialUnit.ts (buildReceivePayload / receivePreview / receiveZeroCost).
   Sabab: kirim shakli endi materialning `unit`iga bog'liq (dona vs pochka) — ikkita payload
   quruvchi drift keltiradi, shuning uchun YAGONA manba materialUnit.ts da. */

/** Partiya optioniga QISQA yuk konteksti — "Yuk 7 · 01.08" (ikki o'xshash partiyani ajratish).
    delivery_detail.received_at "2026-08-01" → "01.08". Yuk bo'lmasa bo'sh string. */
export const batchDeliveryTag = (dd?: { number: string; received_at: string } | null): string => {
  if (!dd) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dd.received_at || "");
  const date = m ? `${m[3]}.${m[2]}` : "";
  return `${DELIVERY.one} ${dd.number}${date ? ` · ${date}` : ""}`;
};

/* ===== POCHKA → DONA NARXI (yaxlitlash) — server bilan AYNAN bir xil bo'lishi shart =====
   Qoida (spec): dona narxi = round(pochka narxi / pochkadagi dona / 100) * 100.
   AVVAL bo'lamiz (pochka/dona), KEYIN 100 ga yaxlitlaymiz (round-then-divide EMAS).
   Yarmi va undan yuqorisi tepaga (Math.round musbatlarda half-up). 50 dan past → 0. */
export const exactPerStem = (bunchPrice: number, stemsPerBunch: number): number =>
  !stemsPerBunch || stemsPerBunch <= 0 ? 0 : bunchPrice / stemsPerBunch;

export const roundToHundred = (n: number): number => Math.round(n / 100) * 100;

/** Pochka narxidan yaxlitlangan dona narxi (server saqlaydigan qiymat). */
export const perStemFromBunch = (bunchPrice: number, stemsPerBunch: number): number =>
  roundToHundred(exactPerStem(bunchPrice, stemsPerBunch));

/** Yaxlitlash dona narxni O'ZGARTIRDIMI — formada "(yaxlitlandi, aniq hisob 998)" izohi uchun.
    exact butun bo'lmasa ham (masalan 998.4) taqqoslash aniq: exactRounded ≠ rounded. */
export const roundingNote = (bunchPrice: number, stemsPerBunch: number): { rounded: number; exact: number; changed: boolean; zeroed: boolean } => {
  const exact = exactPerStem(bunchPrice, stemsPerBunch);
  const rounded = roundToHundred(exact);
  return { rounded, exact, changed: Math.round(exact) !== rounded, zeroed: bunchPrice > 0 && rounded === 0 };
};

/* ===== SAQLANGAN PARTIYA — server `rounding` bloki (DISPLAY-ONLY) =====
   ⚠️ SAQLANGAN partiya narxini KO'RSATISH server blokidan chiqadi — farqni O'ZIMIZ hisoblamaymiz,
   exact'ni hisobga ULAMAYMIZ. (Forma preview'i ayri: u round(bunch/stems/100)*100 client helper'idan.) */
const num2 = (n: number) => n.toLocaleString("ru", { maximumFractionDigits: 2 });
/** "(aniq: 998 · +2)" — FAQAT is_rounded=true bo'lganda (aks holda null → ko'rsatma). Server sonlari. */
export const roundingHint = (side?: RoundingSide | null): string | null => {
  if (!side || !side.is_rounded) return null;
  const sign = side.per_stem_diff > 0 ? "+" : "";
  return `aniq: ${num2(side.per_stem_exact)} · ${sign}${num2(side.per_stem_diff)}`;
};
/** Yuk sarlavhasi uchun: "aniq hisob: 99 800 · yaxlitlashdan +200" — FAQAT rounding_diff ≠ 0 bo'lganda. */
export const deliveryRoundingHint = (d: Pick<StockDelivery, "total_cost_exact" | "rounding_diff">): string | null => {
  if (!d.rounding_diff) return null;
  const sign = d.rounding_diff > 0 ? "+" : "";
  return `aniq hisob: ${num2(d.total_cost_exact ?? 0)} · yaxlitlashdan ${sign}${num2(d.rounding_diff)}`;
};

/* ===== PARTIYA (StockBatch) PAYLOAD — yuk-bog'langan holat + pochka/dona narx qoidasi =====
   ⚠️ NARX: pochka qiymati ASOSIY; dona qiymati FAQAT operator qo'lda kiritganda yuboriladi.
   Ikkalasi ham yuborilsa server hech narsa hisoblamaydi (ataylab override). Standart: pochka only.
   ⚠️ YUK-bog'langanda batch_number/received_at/supplier YUBORILMAYDI — ular yukdan olinadi. */
export type BatchPayloadInput = {
  variant: number;
  heightCm: number;
  stemsPerBunch: number;
  /** yuk (delivery) id — berilsa batch_number/received_at/supplier TASHLANADI */
  deliveryId?: number | null;
  /** faqat yuk-bog'lanmagan holatda */
  supplier?: number | null;
  batchNumber?: string;
  receivedAt?: string;
  /** miqdor — faqat BITTASI (pochka yoki dona) */
  receivedBunches?: number | null;
  receivedStems?: number | null;
  /** narx — pochka asosiy; dona faqat override bo'lganda */
  costPerBunch?: string | null;
  costPerStem?: string | null; // qo'lda override
  salePerBunch?: string | null;
  salePerStem?: string | null; // qo'lda override
  minimumSaleStems?: number | null;
  imageUrl?: string | null;
  /** TEKIN GUL — true bo'lsa tannarx UMUMAN yuborilmaydi (server ham 0 qiladi, lekin
      o'z payload'imizda server tozalashiga TAYANMAYMIZ). Sotuv narxi qoladi. */
  isFree?: boolean;
};
export function buildBatchPayload(v: BatchPayloadInput): Record<string, unknown> {
  const p: Record<string, unknown> = { variant: v.variant, height_cm: v.heightCm, stems_per_bunch: v.stemsPerBunch };
  if (v.deliveryId) {
    p.delivery = v.deliveryId;
    // batch_number / received_at / supplier ATAYLAB yuborilmaydi — yukdan olinadi
  } else {
    if (v.batchNumber) p.batch_number = v.batchNumber;
    if (v.receivedAt) p.received_at = v.receivedAt.slice(0, 10);
    if (v.supplier) p.supplier = v.supplier;
  }
  if (v.receivedBunches != null) p.received_bunches = v.receivedBunches.toFixed(2);
  else if (v.receivedStems != null) p.received_stems = v.receivedStems;
  // ⚠️ TEKIN GUL: is_free yuboriladi va TANNARX KALITLARI UMUMAN QO'YILMAYDI.
  // Server is_free bilan kelgan tannarxni 0 qilardi, ammo biz o'z payload'imizda
  // server tozalashiga tayanmaymiz — noto'g'ri qiymat yo'lga chiqmasin.
  if (v.isFree) {
    p.is_free = true;
  } else {
    // narx: yuborilganini qo'yamiz — ikkalasi bo'lsa (override) ikkalasi ketadi, aks holda pochka only
    if (v.costPerBunch) p.cost_per_bunch = v.costPerBunch;
    if (v.costPerStem) p.cost_per_stem = v.costPerStem;
  }
  if (v.salePerBunch) p.sale_price_per_bunch = v.salePerBunch;
  if (v.salePerStem) p.sale_price_per_stem = v.salePerStem;
  if (v.minimumSaleStems) p.minimum_sale_stems = v.minimumSaleStems;
  if (v.imageUrl) p.image_url = v.imageUrl;
  return p;
}

/* ===== PARTIYA TAHRIRLASH (PATCH) — FAQAT O'ZGARGAN maydonlar =====
   ⚠️ To'liq-obyekt ustiga yozish EMAS: tegilmagan maydon QAYTA YUBORILMAYDI (user-branch
   payload'i bilan bir xil intizom). Narx qoidasi create bilan bir xil: pochka asosiy;
   dona narxi FAQAT «qo'lda kiritish» (manual) da yuboriladi — override bo'lsa ikkalasi ham. */
export type BatchEditForm = {
  batch_number: string;
  received_at: string; // "YYYY-MM-DD"
  height_cm: string;
  /** ⚠️ KELGAN MIQDOR — xato kiritishni to'g'rilash uchun (dona; forma pochkada ham kiritadi). */
  received_stems: string;
  /** GUL NAVI — noto'g'ri nav tanlangan bo'lsa tuzatiladi (RETROAKTIV: bu partiyadan
      yasalgan kataloglarning gul nomi/navi ham o'zgargandek ko'rinadi). */
  variant: number;
  /** YUK — boshqa yukka ko'chirish. ⚠️ raqam/sana/POSTAVSHIK birga o'zgaradi. */
  delivery: number;
  /** TEKIN GUL — yoqilsa tannarx maydonlari yashiriladi va payload'ga tannarx QO'YILMAYDI. */
  is_free: boolean;
  /** ⚠️ QOLDIQNI QO'LDA BELGILASH (inventarizatsiya) — sukut bo'yicha O'CHIQ.
      Yoqilmasa `remaining_stems` payload'ga UMUMAN kirmaydi va server qoldiqni
      O'ZI qayta hisoblaydi (kelgan farqi qancha bo'lsa qoldiq o'shancha siljiydi).
      Yoqilsa server avtomatik hisobini BEKOR QILADI va aynan shu son qo'yiladi. */
  remainingManual: boolean;
  remaining_stems: string;
  stems_per_bunch: string;
  minimum_sale_stems: string;
  /** BO'Y ORALIG'I — «40–60 sm» partiyalar uchun (ixtiyoriy) */
  height_from_cm: string;
  height_to_cm: string;
  /** ⚠️ POSTAVSHIK — FAQAT yuk tanlanmagan partiyada; yuk bo'lsa undan keladi va o'qish uchun. */
  supplier: number;
  /** FAOL — arxivdan qaytarish / arxivlash uchun (o'chirish emas) */
  is_active: boolean;
  notes: string;
  image_url: string;
  cost_per_bunch: string;
  sale_price_per_bunch: string;
  cost_per_stem: string; // override qiymati
  sale_price_per_stem: string; // override qiymati
  costManual: boolean;
  saleManual: boolean;
};
/**
 * GUL NAVI QULFI — partiyadan biror narsa ishlatilgan bo'lsa nav o'zgartirilmaydi.
 *
 * ⚠️ NEGA: nav almashtirilsa shu partiyadan AVVAL yasalgan buketlar tarkibi ham
 * qayta yoziladi — `Prut` dan yasalgan buket katalogda `Alfalob` bo'lib ko'rinardi.
 *
 * ⚠️ BU TEKSHIRUV — ZAIF TAXMIN. Server «ishlatilgan» ni KENGROQ tushunadi:
 * qoldiq kam, YOKI katalog tarkibida, YOKI floristga chiqarilgan, YOKI leadda,
 * YOKI biror chiqim/chiqit harakati bo'lgan. Ya'ni bu yerda «qulflanmagan» degani
 * RUXSAT degani EMAS — server baribir 400 qaytarishi mumkin. Shuning uchun UI
 * 400 ni AYNAN ko'rsatib, maydonni o'shandan keyin qulflashi kerak.
 */
export const batchVariantLocked = (b: { received_stems?: number; remaining_stems?: number }): boolean =>
  b.received_stems != null && b.remaining_stems != null && b.remaining_stems !== b.received_stems;

/** Serverning nav qulfi matni (400) — AYNAN nusxa. */
export const VARIANT_LOCKED_HINT = "Bu partiyadan gul ishlatilgan, navni almashtirib bo'lmaydi";

/* ===== NAVNI ALMASHTIRISH (change-variant) ===== */

/**
 * ⚠️ NOTO'G'RI ISHLATISH OGOHLANTIRISHI — spec «Qachon ishlatmaslik kerak».
 * Tizim ikki holatni FARQLAY OLMAYDI, shuning uchun sabab majburiy.
 */
export const VARIANT_CHANGE_MISUSE =
  "Bu amal FAQAT «nav boshidanoq xato yozilgan» holat uchun — ya'ni o'sha buketlarda haqiqatan shu yangi nav bo'lgan, faqat yorlig'i noto'g'ri edi. " +
  "Agar partiya ROSTDAN eski nav bo'lgan va siz qatorni boshqa gul uchun qayta ishlatmoqchi bo'lsangiz — ALMASHTIRMANG, yangi partiya kiriting: " +
  "aks holda o'tgan buketlar noto'g'ri gul bilan qolib ketadi. Tizim bu ikkisini farqlay olmaydi.";

/** Nima o'zgaradi / nima o'zgarmaydi — operator pulga tegadi deb o'ylamasin. */
export const VARIANT_CHANGE_EFFECT =
  "Ishlatilgan joylarda gul NOMI yangi navga o'zgaradi (sotilgan tarix ham). Narxlar, sonlar va foyda O'ZGARMAYDI.";

/** ⚠️ Orqaga qaytarish yo'li YO'Q (OpenAPI'da teskari endpoint yo'q). */
export const VARIANT_CHANGE_IRREVERSIBLE = "Qaytarib bo'lmaydi";

/**
 * Tasdiq oynasi KERAKMI — serverning `is_used` hukmiga qaraymiz, o'z taxminimizga EMAS.
 * `is_used: false` → oddiy PATCH yetarli (tarix yo'q).
 */
export const variantChangeNeedsDialog = (u: Pick<BatchUsage, "is_used"> | null | undefined): boolean => !!u?.is_used;

/**
 * POST change-variant/ payload. `reason` MAJBURIY (audit jurnaliga yoziladi).
 * Ayni nav tanlansa `null` — «Bu nav allaqachon tanlangan» 400'ini UI darajasida oldini olamiz.
 */
export function buildVariantChangePayload(
  variantId: number, reason: string, currentVariantId: number,
): { variant: number; reason: string } | null {
  const r = (reason ?? "").trim();
  if (!(variantId > 0) || variantId === currentVariantId || r === "") return null;
  return { variant: variantId, reason: r };
}

/** Tasdiq oynasida ko'rsatiladigan qatorlar — FAQAT nolga teng bo'lmaganlari. */
export function variantUsageLines(u: BatchUsage | null | undefined): { label: string; value: string }[] {
  if (!u) return [];
  const out: { label: string; value: string }[] = [];
  if (u.catalog_items > 0) {
    out.push({
      label: "Katalog",
      value: u.sold_catalog_items > 0
        ? `${u.catalog_items} ta (${u.sold_catalog_items} tasi SOTILGAN)`
        : `${u.catalog_items} ta`,
    });
  }
  if (u.used_stems > 0) out.push({ label: "Ketgan gul", value: `${u.used_stems.toLocaleString("ru")} dona` });
  if (u.florist_issues > 0) out.push({ label: "Floristga chiqarilgan", value: `${u.florist_issues} ta` });
  if (u.lead_usages > 0) out.push({ label: "Buyurtmada", value: `${u.lead_usages} ta` });
  if (u.stock_movements > 0) out.push({ label: "Sklad harakati", value: `${u.stock_movements} ta` });
  return out;
}

/**
 * POCHKADAGI DONA o'zgarganda dona narxlari qayta hisoblanadi:
 * pochka narxi O'ZGARMAYDI, dona narxi = pochka / yangi spb, 100 ga yaxlitlanadi.
 * ⚠️ TEKIN partiyada (`is_free`) dona TANNARXI baribir 0 — «arvoh» hisob ko'rsatilmaydi.
 */
export function spbPriceRecompute(
  costBunch: number, saleBunch: number, spbFrom: number, spbTo: number, isFree = false,
): { changed: boolean; costFrom: number; costTo: number; saleFrom: number; saleTo: number; showCost: boolean } {
  const changed = spbFrom > 0 && spbTo > 0 && spbFrom !== spbTo;
  return {
    changed,
    costFrom: isFree ? 0 : perStemFromBunch(costBunch, spbFrom),
    costTo: isFree ? 0 : perStemFromBunch(costBunch, spbTo),
    saleFrom: perStemFromBunch(saleBunch, spbFrom),
    saleTo: perStemFromBunch(saleBunch, spbTo),
    showCost: !isFree,
  };
}

/**
 * PARTIYANI O'CHIRISH natijasi — DELETE ikki xil tugaydi:
 *   204 (tanasiz)  → partiya haqiqatan O'CHDI (tegilmagan edi)
 *   200 + {detail, is_active:false} → sklad tarixi bor edi, ARXIVLANDI
 * ⚠️ OpenAPI faqat 204 ni e'lon qiladi — 200 hujjatlashtirilmagan (LIST 2).
 * `request()` 204 da `undefined`, 200 da tanani qaytaradi — shundan ajratamiz.
 */
export function describeBatchDeleteResult(body: unknown): { archived: boolean; message: string } {
  const detail = body && typeof body === "object" && "detail" in body
    ? String((body as { detail: unknown }).detail) : "";
  // is_active:false yoki umuman tana bo'lsa — ARXIVLANDI (o'chmadi)
  const archived = !!body && typeof body === "object";
  return {
    archived,
    message: archived
      ? (detail || "Partiyada sklad tarixi bor — o'chirilmadi, arxivlandi (is_active=false).")
      : "Partiya o'chirildi.",
  };
}

export type BatchEditOriginal = {
  batch_number?: string; received_at?: string; height_cm?: number; stems_per_bunch?: number;
  height_from_cm?: number | null; height_to_cm?: number | null;
  /** ⚠️ postavshik — FAQAT yuksiz partiyada tahrirlanadi (yuk bo'lsa undan keladi) */
  supplier?: number | null;
  is_active?: boolean;
  minimum_sale_stems?: number; notes?: string; image_url?: string;
  cost_per_bunch?: string | null; sale_price_per_bunch?: string | null; cost_per_stem?: string | null; sale_price_per_stem?: string | null;
  /** kelgan/qolgan — «ishlatilgan»ni hisoblash uchun (received − remaining) */
  received_stems?: number; remaining_stems?: number;
  is_free?: boolean;
  variant?: number; delivery?: number | null;
};

/**
 * KELGAN MIQDORNI TO'G'RILASH — OQIBAT HISOBI (sof, testlanadi).
 *
 * «Ishlatilgan» = kelgan − qoldiq. Bu qiymat florist chiqimi, qaytarish, chiqit VA katalog
 * sarfini QAMRAB OLADI, chunki ularning hammasi `remaining_stems` ni harakatlantiradi
 * (jonli tekshirilgan: #62 kirim +100, chiqim −100, chiqim −25, qaytarish +25 → qoldiq 0).
 *
 * ⚠️ SERVER XATTI-HARAKATI NOMA'LUM (read-only aniqlab bo'lmadi): `remaining_stems` PATCH'da
 * ALOHIDA yoziladigan maydon (readOnly EMAS) — ya'ni server `received_stems` o'zgarganda
 * qoldiqni QAYTA HISOBLAMASLIGI ehtimoli katta. Shu bois KLIENT tomonda qat'iy bloklaymiz:
 * ishlatilgandan kam qiymat YUBORILMAYDI (aks holda qoldiq manfiy yoki eskirgan bo'lib qoladi).
 */
export type ReceivedEditConsequence = {
  /** ishlatilgan (kelgan − qoldiq); hech qachon manfiy emas */
  used: number;
  receivedFrom: number;
  receivedTo: number;
  remainingFrom: number;
  /** yangi qoldiq = yangi kelgan − ishlatilgan (manfiy bo'lishi MUMKIN — shuni ko'rsatamiz) */
  remainingTo: number;
  /** o'zgardimi (aks holda blok/ogohlantirish ko'rsatilmaydi) */
  changed: boolean;
  /** kamaytirilyaptimi (xavfli yo'nalish) */
  decreasing: boolean;
  /** yangi qoldiq manfiy — SAQLASH BLOKLANADI */
  negative: boolean;
};

export function receivedEditConsequence(
  origReceived: number | null | undefined,
  origRemaining: number | null | undefined,
  nextReceived: number | string | null | undefined,
): ReceivedEditConsequence {
  const receivedFrom = Math.max(Math.round(+(origReceived ?? 0) || 0), 0);
  const remainingFrom = Math.max(Math.round(+(origRemaining ?? 0) || 0), 0);
  const used = Math.max(receivedFrom - remainingFrom, 0);
  const raw = typeof nextReceived === "string" ? parseFloat(nextReceived) : nextReceived;
  const receivedTo = Number.isFinite(raw as number) ? Math.max(Math.round(raw as number), 0) : receivedFrom;
  const remainingTo = receivedTo - used;
  return {
    used, receivedFrom, receivedTo, remainingFrom, remainingTo,
    changed: receivedTo !== receivedFrom,
    decreasing: receivedTo < receivedFrom,
    negative: remainingTo < 0,
  };
}
const numEq = (a: string, b: string | number | undefined | null): boolean =>
  (parseFloat(a) || 0) === (b == null ? 0 : typeof b === "string" ? (parseFloat(b) || 0) : b);
function addPriceEdit(p: Record<string, unknown>, kind: "cost" | "sale", manual: boolean, bunch: string, stem: string, origBunch?: string | null, origStem?: string | null) {
  const bunchKey = kind === "cost" ? "cost_per_bunch" : "sale_price_per_bunch";
  const stemKey = kind === "cost" ? "cost_per_stem" : "sale_price_per_stem";
  const bunchChanged = bunch.trim() !== "" && !numEq(bunch, origBunch);
  if (manual) {
    // OVERRIDE — dona narxi o'zgargan bo'lsa yuboriladi; pochka ham o'zgargan bo'lsa u ham (ikkalasi knowingly)
    if (stem.trim() !== "" && !numEq(stem, origStem)) p[stemKey] = String(+stem);
    if (bunchChanged) p[bunchKey] = String(+bunch);
  } else if (bunchChanged) {
    // AVTO — faqat pochka narxi (server dona narxini qayta hisoblaydi); dona YUBORILMAYDI
    p[bunchKey] = String(+bunch);
  }
}
export function buildBatchEditPayload(orig: BatchEditOriginal, form: BatchEditForm): Record<string, unknown> {
  const p: Record<string, unknown> = {};
  if (form.batch_number.trim() !== (orig.batch_number ?? "")) p.batch_number = form.batch_number.trim();
  const origDate = (orig.received_at ?? "").slice(0, 10);
  if (form.received_at && form.received_at.slice(0, 10) !== origDate) p.received_at = form.received_at.slice(0, 10);
  if (+form.height_cm > 0 && +form.height_cm !== orig.height_cm) p.height_cm = +form.height_cm;
  // ⚠️ KELGAN MIQDOR — faqat O'ZGARGANDA va faqat XAVFSIZ bo'lsa (ishlatilgandan kam emas).
  // Bloklanган holatda kalit UMUMAN yuborilmaydi (UI ham saqlashga yo'l qo'ymaydi).
  {
    const raw = form.received_stems ?? ""; // maydonsiz eski chaqiruvchilar uchun himoya
    const c = receivedEditConsequence(orig.received_stems, orig.remaining_stems, raw);
    if (raw.trim() !== "" && c.changed && !c.negative) p.received_stems = c.receivedTo;
  }
  // ⚠️ QOLDIQ — FAQAT operator «qo'lda belgilash»ni ATAYLAB yoqqanda yuboriladi.
  // Tasodifan qo'shilsa serverning avtomatik qayta hisobi JIMGINA o'chib qoladi.
  if (form.remainingManual) {
    const rv = (form.remaining_stems ?? "").trim();
    if (rv !== "" && Number.isFinite(+rv) && +rv !== orig.remaining_stems) p.remaining_stems = Math.max(Math.round(+rv), 0);
  }
  if (+form.stems_per_bunch > 0 && +form.stems_per_bunch !== orig.stems_per_bunch) p.stems_per_bunch = +form.stems_per_bunch;
  if (+form.minimum_sale_stems > 0 && +form.minimum_sale_stems !== orig.minimum_sale_stems) p.minimum_sale_stems = +form.minimum_sale_stems;
  // BO'Y ORALIG'I — bo'sh qoldirilsa tegilmaydi (null yuborilmaydi)
  const hf = (form.height_from_cm ?? "").trim();
  if (hf !== "" && +hf > 0 && +hf !== (orig.height_from_cm ?? 0)) p.height_from_cm = +hf;
  const ht = (form.height_to_cm ?? "").trim();
  if (ht !== "" && +ht > 0 && +ht !== (orig.height_to_cm ?? 0)) p.height_to_cm = +ht;
  // ⚠️ POSTAVSHIK — FAQAT yuksiz partiyada. Yuk tanlangan bo'lsa postavshik YUKDAN keladi,
  // uni alohida yuborish desync qilardi.
  const hasDelivery = (form.delivery ?? 0) > 0 || (orig.delivery ?? 0) > 0;
  if (!hasDelivery && (form.supplier ?? 0) > 0 && form.supplier !== (orig.supplier ?? 0)) p.supplier = form.supplier;
  if (form.is_active !== undefined && !!form.is_active !== (orig.is_active ?? true)) p.is_active = !!form.is_active;
  // ⚠️ GUL NAVI — ISHLATILGAN partiyada YUBORILMAYDI (server 400 beradi va bu to'g'ri:
  // nav almashsa avval yasalgan buketlar tarkibi ham qayta yozilardi).
  if (!batchVariantLocked(orig) && form.variant > 0 && form.variant !== orig.variant) p.variant = form.variant;
  // ⚠️ YUK almashtirilsa partiya boshqa yukka ko'chadi: raqam/sana/POSTAVSHIK va shu bilan
  // qaysi postavshikning «Umumiy sotib olingan» summasiga kirishi ham o'zgaradi.
  if (form.delivery > 0 && form.delivery !== orig.delivery) p.delivery = form.delivery;
  if (form.notes !== (orig.notes ?? "")) p.notes = form.notes;
  if (form.image_url !== (orig.image_url ?? "")) p.image_url = form.image_url;
  // ⚠️ TEKIN GUL — o'zgargan bo'lsa yuboriladi. TEKIN bo'lsa TANNARX KALITLARI QO'YILMAYDI
  // (server ularni 0 qilardi, lekin biz server tozalashiga tayanmaymiz).
  const free = !!form.is_free;
  if (free !== !!orig.is_free) p.is_free = free;
  if (!free) addPriceEdit(p, "cost", form.costManual, form.cost_per_bunch, form.cost_per_stem, orig.cost_per_bunch, orig.cost_per_stem);
  addPriceEdit(p, "sale", form.saleManual, form.sale_price_per_bunch, form.sale_price_per_stem, orig.sale_price_per_bunch, orig.sale_price_per_stem);
  return p;
}
/** RETROAKTIV o'zgarish bormi — tannarx/pochka-dona bo'linishi (avval yasalgan kataloglar tannarxiga ta'sir). */
/** ⚠️ RETROAKTIV — tannarx/pochka-dona VA kelgan miqdor (partiya jami → yuk jamilari va tannarx raqamlari siljiydi). */
export const batchEditIsRetroactive = (payload: Record<string, unknown>): boolean =>
  "cost_per_bunch" in payload || "cost_per_stem" in payload || "stems_per_bunch" in payload || "received_stems" in payload || "is_free" in payload || "variant" in payload;

/* ===== yuborishdan oldin NORMALLASHTIRISH (katalog / social post) =====
   Bitta buket/savat = BITTA CatalogItem, ichida ko'p qatorli composition.
   Bir xil stock_batch (yoki packaging) qatorlari BITTAGA birlashtiriladi
   (miqdorlar qo'shiladi) — backend ham himoya uchun birlashtiradi, ammo biz
   ideal shaklni yuboramiz. */
export type CompEntry = { stock_batch: number; quantity_stems: number; quantity_bunches?: string };
export const normalizeComposition = (rows: CompEntry[]): CompEntry[] => {
  const map = new Map<number, CompEntry>();
  for (const r of rows) {
    if (!r.stock_batch) continue;
    const ex = map.get(r.stock_batch);
    if (ex) {
      ex.quantity_stems += r.quantity_stems || 0;
      if (r.quantity_bunches != null || ex.quantity_bunches != null) {
        const sum = (parseFloat(ex.quantity_bunches ?? "0") || 0) + (parseFloat(r.quantity_bunches ?? "0") || 0);
        ex.quantity_bunches = sum.toFixed(2);
      }
    } else {
      map.set(r.stock_batch, {
        stock_batch: r.stock_batch,
        quantity_stems: r.quantity_stems || 0,
        ...(r.quantity_bunches != null ? { quantity_bunches: r.quantity_bunches } : {}),
      });
    }
  }
  return Array.from(map.values());
};

export type MatEntry = { packaging: number; quantity: number };
export const normalizeMaterials = (rows: MatEntry[]): MatEntry[] => {
  const map = new Map<number, MatEntry>();
  for (const r of rows) {
    if (!r.packaging) continue;
    const ex = map.get(r.packaging);
    if (ex) ex.quantity += r.quantity || 0;
    else map.set(r.packaging, { packaging: r.packaging, quantity: r.quantity || 0 });
  }
  return Array.from(map.values());
};

/* ===== enum yorliqlari ===== */
export const MOVEMENT_LABEL: Record<MovementType, string> = {
  in: "Kirim",
  out: "Chiqim",
  adjustment: "Tuzatish",
  waste: "Chiqit",
  transfer_out: "Ko'chirish (chiqdi)",
  transfer_in: "Ko'chirish (keldi)",
};
/** harakat turkumi → tema-token rangi (ikonka/chip foni) */
export const MOVEMENT_HUE: Record<MovementType, string> = {
  in: "var(--success, #3d8a5f)",
  transfer_in: "var(--success, #3d8a5f)",
  out: "var(--primary)",
  transfer_out: "var(--primary)",
  waste: "var(--danger, #a04a4a)",
  adjustment: "var(--muted)",
};

export const PACKAGING_LABEL: Record<PackagingType, string> = {
  wrap: "Buket qog'ozi",
  basket: "Savat",
  box: "Quti",
  other: "Aksessuarlar",
  accessory: "Aksessuarlar",
};

export const STAFF_LABEL: Record<StaffType, string> = { florist: "Florist", apprentice: "Shogird" };

/** HAJM — YAGONA manba. API qiymati DOIM shu (small/medium/large); UI faqat Uzbek
    yorliq ko'rsatadi. Matritsa/filtr/composer HAMMASI shundan kelib chiqadi —
    hech qayerda erkin "S"/"M"/"L" satr YOZILMAYDI (auto-to'ldirish jimgina buziladi). */
export const VOLUMES = ["small", "medium", "large"] as const;
export const ARRANGEMENTS = ["bouquet", "basket"] as const;
export const VOLUME_LABEL: Record<CatalogVolume, string> = { small: "Kichik", medium: "O'rta", large: "Katta" };
/** ⚠️ HAJM yorlig'i — YAGONA manba. API «small/medium/large» qaytaradi, lekin ba'zi javoblarda
    «S/M/L» ham uchraydi — ikkalasini ham qamraymiz. Hajmsiz (null/"") → «Belgilanmagan».
    Solishtirish/yuborishда HAR DOIM API qiymati (small/medium/large) ishlatiladi, faqat KO'RSATISH shu. */
export const volumeLabel = (v: string | null | undefined): string => {
  const k = (v ?? "").trim().toLowerCase();
  if (k === "small" || k === "s") return "Kichik";
  if (k === "medium" || k === "m") return "O'rta";
  if (k === "large" || k === "l") return "Katta";
  return "Belgilanmagan";
};
/** Qisqa yorliq (matritsa ustuni) — API qiymati emas, faqat ko'rsatish uchun. */
export const VOLUME_SHORT: Record<CatalogVolume, string> = { small: "S", medium: "M", large: "L" };
export const ARRANGEMENT_UZ: Record<(typeof ARRANGEMENTS)[number], string> = { bouquet: "Buket", basket: "Savat" };

/** Tarif ↔ katalog MOSLIGI — aynan satr-tenglik (volume + arrangement_type).
    Backend auto-to'ldirishi ham SHU tenglikni ishlatadi. `small !== "S"` — shuning
    uchun matritsa doim small/medium/large saqlaydi. Faol bo'lmagan tarif hisobga
    olinmaydi. */
export function volumeArrangementMatch(
  rate: Pick<FloristVolumeRate, "volume" | "arrangement_type" | "is_active">,
  volume: CatalogVolume | "" | null | undefined,
  arrangement: ArrangementType | "" | null | undefined,
): boolean {
  if (!volume || !arrangement) return false;
  return rate.is_active !== false && rate.volume === volume && rate.arrangement_type === arrangement;
}

/** Katalog uchun mos tarifni topadi (florist + hajm + turi). `florist` berilsa,
    faqat o'sha floristning tarifi olinadi (per-florist model). */
export function rateSalaryForCatalog(
  rates: FloristVolumeRate[] | null | undefined,
  florist: number | null | undefined,
  volume: CatalogVolume | "" | null | undefined,
  arrangement: ArrangementType | "" | null | undefined,
): FloristVolumeRate | undefined {
  if (!rates || !florist) return undefined;
  return rates.find((r) => r.florist === florist && volumeArrangementMatch(r, volume, arrangement));
}

/**
 * STANDART katalog + florist + hajm tanlangan bo'lsa HAJM TARIFI MAJBURIY.
 * Backend 400 beradi (KATALOG_TAHRIR_MATERIAL_VA_CHIQIM §3):
 *   { "volume": ["<Florist> uchun bu hajm tarifi belgilanmagan. Avval floristga hajm narxini kiriting."] }
 * Shuning uchun SAQLASHNI KLIENTDA bloklaymiz — operator 400 ni kashf qilmasin.
 *
 * ⚠️ CUSTOM katalogda tarif SHART EMAS — u yerda haq qo'lda kiritiladi (spec §3), shuning uchun
 * bloklamaymiz. Tarifsiz floristlar (jonli audit 2026-08-03: 10 dan 6 tasi, ulardan 4 tasi
 * SHOGIRD — shogirdning tariflari kunlik haq sababli avtomatik nofaol) faqat standart
 * katalogda to'siladi.
 */
export const catalogRateMissing = (
  kind: CatalogKind,
  florist: number | null | undefined,
  volume: CatalogVolume | "" | null | undefined,
  arrangement: ArrangementType | "" | null | undefined,
  rates: FloristVolumeRate[] | null | undefined,
): boolean =>
  kind === "standard" && !!florist && !!volume && !rateSalaryForCatalog(rates, florist, volume, arrangement);

/** ⚠️ NOM TUZOG'I xaritasi — YAGONA joy:
    tarifning `florist_fee` (florist ISH HAQI) → katalogning `florist_salary_amount`.
    Katalogning O'ZINING `florist_fee` (mijozdan xizmat haqi) bilan ARALASHTIRMANG. */
export const rateToCatalogSalary = (rate: FloristVolumeRate): string => String(Math.round(+rate.florist_fee));

/** Matritsa katagi (tahrirlanadigan holat). `fee` = florist ish haqi (rate.florist_fee). */
export type RateCell = { arrangement_type: (typeof ARRANGEMENTS)[number]; volume: CatalogVolume; fee: string; stems: string };
/** TO'LIQ ALMASHTIRISH payload — FAQAT to'ldirilgan kataklar (fee bor) yuboriladi.
    ⚠️ Yuborilmagan katak backend'da is_active:false bo'ladi (ataylab). Bo'sh grid → []
    (hammasi o'chadi — UI'da alohida tasdiq bilan himoyalanadi). Vitest bilan qamralgan. */
export function buildVolumeRatesPayload(cells: RateCell[]): VolumeRateInput[] {
  return cells
    .filter((c) => c.fee.trim() !== "")
    .map((c) => ({
      arrangement_type: c.arrangement_type,
      volume: c.volume,
      florist_fee: String(+c.fee),
      ...(c.stems.trim() !== "" ? { default_stems: +c.stems } : {}),
    }));
}

/** Katalog `florist_salary_amount` payload — ⚠️ HAR IKKI rejimda forma qiymati YUBORILADI (florist
    haqi endi TAHRIRLANADI; auto-fill tarifdan, lekin operator ustidan yozishi mumkin). ZERO ≠ BO'SH:
        · "" / null → kalit TUSHIRILADI (tarif yo'q va bo'sh qoldirildi)
        · "0"       → "0" YUBORILADI (operator ataylab nol qildi)
        · boshqa    → son sifatida yuboriladi
    Falsy tekshiruv (`if (v)`) ISHLATILMAYDI — u ataylab "0" ni bo'shdek talqin qilardi. */
export function catalogSalaryPayload(value: string | null | undefined): { florist_salary_amount: string } | Record<string, never> {
  // ⚠️ Endi HAR IKKI rejimda (standart+custom) forma qiymati AYNAN yuboriladi — backend uni tarif
  //    bilan bosib o'tmaydi (spec: "if we send the fee explicitly, the server does NOT overwrite it").
  if (value === "" || value == null) return {}; // bo'sh → kalit tushiriladi (tarif yo'q holati)
  return { florist_salary_amount: String(+value) }; // "0" ham AYNAN yuboriladi (ataylab nol)
}

/** Chiqim TAHRIRI delta preview — «Skladda: 300 → 280 · Floristda: 30 → 50».
    Yo'nalish `kind` bo'yicha: issue sklad→florist, return florist→sklad, waste florist→yo'q.
    Δ = yangi − eski. Sof HISOB (server bilan mos), Vitest bilan qamraladi.
    `skladNow`/`floristNow` — HOZIRGI qoldiqlar (null → noma'lum, o'sha qator ko'rsatilmaydi). */
export function computeIssueEditDelta(
  kind: FloristStockIssueKind,
  oldQty: number,
  newQty: number,
  skladNow: number | null,
  floristNow: number | null,
): { sklad: { from: number; to: number } | null; florist: { from: number; to: number } | null } {
  const d = newQty - oldQty;
  // issue: sklad −Δ, florist +Δ | return: sklad +Δ, florist −Δ | waste: sklad tegilmaydi, florist −Δ
  const skladDelta = kind === "issue" ? -d : kind === "return" ? +d : 0;
  const floristDelta = kind === "issue" ? +d : -d; // return & waste ikkalasi ham florist −Δ
  return {
    sklad: kind === "waste" || skladNow == null ? null : { from: skladNow, to: skladNow + skladDelta },
    florist: floristNow == null ? null : { from: floristNow, to: floristNow + floristDelta },
  };
}
export const KIND_LABEL: Record<CatalogKind, string> = { standard: "Standart", custom: "Maxsus" };
export const SALARY_SOURCE_LABEL: Record<SalarySource, string> = {
  catalog: "Katalog",
  custom_catalog: "Maxsus katalog",
  decoration: "Oformleniya",
  sale_decoration: "Sotuv oformleniyasi",
  daily: "Kunlik",
  manual: "Qo'lda",
};
export const SALARY_SOURCE_HUE: Record<SalarySource, string> = {
  catalog: "var(--primary)",
  custom_catalog: "#6a6ac2",
  decoration: "var(--acc)",
  sale_decoration: "#c27ba0",
  daily: "#b3873a",
  manual: "#8a8a8a",
};

/* ===== freshness (yangilik) — gul eskiradi, operatsion muhim ===== */
export type Freshness = { days: number; label: string; hue: string };
export const freshness = (receivedAt?: string | null): Freshness => {
  if (!receivedAt) return { days: 0, label: "—", hue: "var(--muted)" };
  const d = new Date(receivedAt);
  if (Number.isNaN(d.getTime())) return { days: 0, label: "—", hue: "var(--muted)" };
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000));
  const label = days === 0 ? "Bugun" : `${days} kunlik`;
  const hue = days <= 3 ? "#3d8a5f" : days <= 7 ? "#b3873a" : "#a04a4a";
  return { days, label, hue };
};

/* ===== stem gauge holati ===== */
export type GaugeState = { pct: number; hue: string; tone: "ok" | "low" | "empty" };
export const gaugeOf = (b: Pick<StockBatch, "remaining_stems" | "received_stems">): GaugeState => {
  const total = Math.max(b.received_stems || 0, 1);
  const pct = Math.max(0, Math.min(1, (b.remaining_stems || 0) / total));
  if (b.remaining_stems <= 0) return { pct: 0, hue: "var(--muted)", tone: "empty" };
  if (pct < 0.2) return { pct, hue: "#b3873a", tone: "low" }; // amber
  return { pct, hue: "var(--primary)", tone: "ok" };
};


/* ═══════════════════════════════════════════════════════════════════════════
   TEKIN GUL (is_free) — KO'RSATISH va TARTIB
   ═══════════════════════════════════════════════════════════════════════════ */

/** Partiya tekinmi (xavfsiz o'qish — maydon eski javoblarda bo'lmasligi mumkin). */
export const isFreeBatch = (b: { is_free?: boolean } | null | undefined): boolean => !!b?.is_free;

/** Tannarx yorlig'i: tekin partiyada 0 «yo'qolgan ma'lumot» kabi ko'rinmasin.
    tekin → «0 so'm · tekin», aks holda odatdagi pul formati (chaqiruvchi fmt beradi). */
export const batchCostLabel = (
  b: { is_free?: boolean } | null | undefined,
  formatted: string,
): string => (isFreeBatch(b) ? "0 so'm · tekin" : formatted);

/**
 * PARTIYA TARTIBI — «oxirgi qo'shilgan birinchi».
 *
 * ⚠️ SERVER FAQAT `received_at` bo'yicha tartiblaydi (jonli tekshiruv 2026-08-03:
 * `?ordering=-id` va `?ordering=-created_at` E'TIBORGA OLINMAYDI — natija tartibsiz
 * bazaviy holat bilan bir xil; `-received_at,-id` ham ikkinchi kalitni tashlab yuboradi).
 * `received_at` esa SANA — bir kunda 46 tagacha partiya bor va server ichki tartibi
 * BEQAROR (ketma-ket ikki so'rov har xil ketma-ketlik qaytardi).
 *
 * Shuning uchun: serverdan `?ordering=-received_at` so'raymiz (sahifalash to'g'ri ishlashi
 * uchun), so'ng klientda BARQAROR tiebreaker qo'llaymiz: created_at ↓, keyin id ↓.
 * (api.list() barcha sahifalarni yig'adi, shuning uchun klient tartibi to'liq to'plamda ishlaydi.)
 */
export function compareBatchNewestFirst(
  a: { id: number; received_at?: string | null; created_at?: string | null },
  b: { id: number; received_at?: string | null; created_at?: string | null },
): number {
  const da = (a.received_at ?? "").slice(0, 10);
  const db = (b.received_at ?? "").slice(0, 10);
  if (da !== db) return db.localeCompare(da);           // sana ↓
  const ca = a.created_at ?? "";
  const cb = b.created_at ?? "";
  if (ca !== cb) return cb.localeCompare(ca);           // yaratilgan vaqt ↓
  return b.id - a.id;                                   // BARQAROR yakuniy kalit
}

/** Yuk tartibi — partiya bilan AYNAN bir qoida (sana ↓, keyin id ↓). */
export function compareDeliveryNewestFirst(
  a: { id: number; received_at?: string | null; created_at?: string | null },
  b: { id: number; received_at?: string | null; created_at?: string | null },
): number {
  return compareBatchNewestFirst(a, b);
}

/**
 * KATALOG tartibi — «oxirgi qo'shilgan BIRINCHI» (chapdan o'ngga).
 *
 * ⚠️ Nega klientda: server `?ordering=-created_at` ni QABUL QILADI, ammo bir XIL
 * `created_at` li yozuvlar tartibi BARQAROR EMAS — jonli tekshiruvda
 * `2026-08-02T12:00:00` bo'lgan beshta katalog 147,148,146,145,149 tartibida keldi.
 * Bu tasodifiy emas: ORQAGA SANALGAN katalog `lib/backdate.ts` bo'yicha DOIM 12:00 ga
 * qo'yiladi, ya'ni bir kunga surilgan hamma katalog bir xil vaqtga tushadi va
 * har so'rovda joyini almashtiraveradi.
 *
 * Shuning uchun oxirgi kalit — `id` (kiritilish tartibining yagona ishonchli belgisi).
 */
export function compareCatalogNewestFirst(
  a: { id: number; created_at?: string | null },
  b: { id: number; created_at?: string | null },
): number {
  const ca = a.created_at ?? "";
  const cb = b.created_at ?? "";
  if (ca !== cb) return cb.localeCompare(ca);           // yaratilgan vaqt ↓
  return b.id - a.id;                                   // BARQAROR yakuniy kalit
}

/**
 * PARTIYA QIDIRUVI — ko'p so'zli, BO'YNI ham qamrab oladi.
 *
 * «prut 40» kabi so'rov ikki bo'lakdan iborat: gul nomi VA bo'yi. Ilgari butun
 * so'rov bitta maydonga mos kelishi kerak edi, shuning uchun «prut 40» hech narsa
 * topmasdi. Endi so'rov so'zlarga bo'linadi va HAR BIR so'z biror maydonga mos
 * kelishi kerak (so'zlar orasida VA, maydonlar orasida YOKI).
 *
 * Qidiriladigan maydonlar: gul nomi, nav, rang, partiya raqami, BO'YI (40 / «40 sm»).
 */
export function batchMatchesQuery(
  b: {
    batch_number?: string | null;
    height_cm?: number | null;
    height_label?: string | null;
    variant_detail?: {
      name_uz?: string | null;
      color_uz?: string | null;
      flower_detail?: { name_uz?: string | null } | null;
    } | null;
  },
  query: string,
): boolean {
  const tokens = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;
  const v = b.variant_detail;
  const fields = [
    v?.flower_detail?.name_uz,
    v?.name_uz,
    v?.color_uz,
    b.batch_number,
    b.height_label,
    // bo'yi raqam sifatida ham («40»), «sm» bilan ham («40 sm») topilsin
    b.height_cm != null ? String(b.height_cm) : null,
    b.height_cm != null ? `${b.height_cm} sm` : null,
  ].map((x) => (x ?? "").toLowerCase());
  return tokens.every((t) => fields.some((f) => f.includes(t)));
}
