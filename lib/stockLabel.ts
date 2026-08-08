/**
 * PARTIYA NOMI — YAGONA manba.
 * Spec: FRONTEND_STOCK_INTAKE_MERGE_API.md (deploy 2026-08-08)
 *
 * ⚠️ NEGA KERAK: kirimda endi NAV so'ralmaydi. Yangi qatorlarda `variant_detail`
 * texnik («general») bo'ladi — `name_uz` va `color_uz` BO'SH, `is_general: true`.
 * Nomni qo'lda yig'sak (`${gul} ${nav}` yoki `${gul} · ${nav} · ${rang}`) natija
 * «Atirgul ·  · » bo'lib, osilib qolgan ajratgichlar chiqadi.
 *
 * ⚠️ SERVER `title` NI O'ZI BERADI va u ESKI qatorlarda ham to'g'ri:
 *     eski  → «Atirgul · Prut · Oq 80 sm»      (haqiqiy nav ko'rinadi)
 *     yangi → «Atirgul 40 sm»                   (nav yo'q, ajratgich ham yo'q)
 * Shu bois qoida: `title` BOR bo'lsa — O'SHA. Yo'q bo'lsa — zaxira yig'ish.
 *
 * ⚠️ UCHTA SHAKL bor, jonli javoblarda tekshirilgan:
 *   1) TO'LIQ partiya          — `title` bor (stock-batches, stock-movements.batch_detail,
 *                                catalog.composition[].batch_detail)
 *   2) TO'LIQ, lekin title'siz — eski keshlangan/qisman obyektlar
 *   3) YUPQA balans shakli     — florist-stock-balances.batch_detail:
 *      {batch_number, color, flower, height_label, id, image_url, stems_per_bunch, variant}
 *      ya'ni TEKIS satrlar, `title` YO'Q. Ayni shu yerda «general» qatorda
 *      `variant` bo'sh keladi va osilgan ajratgich chiqishi mumkin edi.
 */

type Nested = {
  title?: string | null;
  flower_name?: string | null;
  height_label?: string | null;
  flower_detail?: { name_uz?: string | null; name_ru?: string | null } | null;
  variant_detail?: {
    name_uz?: string | null;
    name_ru?: string | null;
    color_uz?: string | null;
    is_general?: boolean;
    flower_detail?: { name_uz?: string | null; name_ru?: string | null } | null;
  } | null;
};

/**
 * Yupqa (balans) shakli — tekis satrlar.
 * ⚠️ NOM VA ID BIR XIL KALITDA: to'liq partiyada `variant` — RAQAM (FK id),
 * yupqa shaklda esa NOM (satr). Shu bois tur `string | number` va faqat SATR
 * bo'lgani nom sifatida o'qiladi — aks holda ekranga «12» degan «nav» chiqardi.
 */
type Flat = {
  flower?: string | number | null;
  variant?: string | number | null;
  color?: string | null;
  height_label?: string | null;
};

export type BatchLike = (Nested & Partial<Flat>) | null | undefined;

/** ⚠️ FAQAT satr — raqam (FK id) kelsa BO'SH qaytadi, id nom bo'lib chiqmaydi. */
const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * ⚠️ «general» nav — foydalanuvchiga KO'RSATILMAYDI.
 * `is_general === true` bo'lsa aniq; maydon yo'q bo'lsa nomiga qaraymiz
 * (bo'sh nom = ko'rsatadigan nav yo'q).
 */
export function isGeneralVariant(b: BatchLike): boolean {
  const vd = b?.variant_detail;
  if (vd && vd.is_general === true) return true;
  if (vd) return s(vd.name_uz) === "" && s(vd.name_ru) === "";
  // yupqa shakl: `variant` SATR bo'lsa va bo'sh bo'lsa — ko'rsatadigan nav yo'q.
  // Raqam bo'lsa (to'liq partiyaning FK id si) bu yerdan hukm chiqarmaymiz.
  const v = (b as Flat | undefined)?.variant;
  if (typeof v === "string") return v.trim() === "";
  return false;
}

/** Faqat GUL nomi (nav va bo'ysiz). */
export function flowerName(b: BatchLike): string {
  if (!b) return "";
  return s(b.flower_name)
    || s(b.variant_detail?.flower_detail?.name_uz) || s(b.variant_detail?.flower_detail?.name_ru)
    || s(b.flower_detail?.name_uz) || s(b.flower_detail?.name_ru)
    || s((b as Flat).flower);
}

/**
 * KO'RSATILADIGAN NAV — faqat haqiqiy nav bo'lganda (eski partiyalar).
 * Yangi «general» qatorda BO'SH qaytadi, ya'ni chaqiruvchi hech narsa chizmaydi.
 */
export function variantName(b: BatchLike): string {
  if (!b || isGeneralVariant(b)) return "";
  return s(b.variant_detail?.name_uz) || s(b.variant_detail?.name_ru) || s((b as Flat).variant);
}

/** RANG — nav kabi, faqat haqiqiy navda. */
export function variantColor(b: BatchLike): string {
  if (!b || isGeneralVariant(b)) return "";
  return s(b.variant_detail?.color_uz) || s((b as Flat).color);
}

/**
 * PARTIYA NOMI — ekranda ko'rsatiladigan to'liq matn.
 *
 * ⚠️ Bo'sh bo'laklar TASHLANADI (`filter(Boolean)`) — shuning uchun «general»
 * qatorda ham osilgan « · » chiqmaydi.
 */
export function batchTitle(b: BatchLike, fallback = "Gul"): string {
  if (!b) return fallback;
  const t = s(b.title);
  if (t) return t;                       // ⚠️ SERVER bergani — eng ishonchli manba
  const parts = [flowerName(b), variantName(b), variantColor(b)].filter(Boolean);
  const head = parts.join(" · ");
  const h = s(b.height_label);
  return [head, h].filter(Boolean).join(" ") || fallback;
}

/**
 * QISQA nom — ro'yxatlarda bo'y ALOHIDA ustunda chiqadigan joylar uchun
 * (bo'y ikki marta ko'rinmasin).
 */
export function batchTitleNoHeight(b: BatchLike, fallback = "Gul"): string {
  if (!b) return fallback;
  const parts = [flowerName(b), variantName(b), variantColor(b)].filter(Boolean);
  if (parts.length) return parts.join(" · ");
  // title'dan bo'yni kesib olamiz (server «… 40 sm» ko'rinishida beradi)
  const t = s(b.title);
  const h = s(b.height_label);
  if (t && h && t.endsWith(h)) return t.slice(0, -h.length).trim() || fallback;
  return t || fallback;
}
