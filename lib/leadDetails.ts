/**
 * LEAD `details` — AI operatorga topshirgan so'rov tafsilotlari.
 * Spec: FRONTEND_AI_OPERATOR_LEADS_API.md (deploy 10.08.2026)
 *
 * ⚠️ NEGA YAGONA JOYDA: `details` — sxemasi OCHIQ obyekt (jonli OpenAPI'da
 * `"details": {}` deb turibdi, ichki maydonlari e'lon qilinmagan). Ya'ni
 * TypeScript bizni himoya qilmaydi va har qanday kalit yo'q bo'lishi mumkin.
 * Shuning uchun butun o'qish shu fayldan o'tadi va har bir maydon zaxira
 * qiymat bilan qaytadi.
 *
 * ⚠️ ESKI LEADLAR: operator qo'lda yaratgan va 10.08.2026 gacha bo'lgan
 * leadlarda `details` UMUMAN bo'lmasligi mumkin. Hech qanday kalit majburiy
 * emas — hammasi `?` bilan o'qiladi va bo'sh bo'lsa ekranda CHIZILMAYDI.
 */

export type LeadTopic = "catalog_order" | "custom_order" | "photo_request" | "question" | "other";

export type LeadDetails = {
  topic?: LeadTopic | "";
  flowers_text?: string;
  size_text?: string;
  photo_urls?: string[];
  note?: string;
  catalog_items?: { catalog_name?: string; quantity?: number }[];
  stock_items?: unknown[];
  created_by?: string;
};

/** ⚠️ Spec'dagi o'zbekcha nomlar — matn shu yerda, komponentlarga sochilmaydi. */
export const TOPIC_LABEL: Record<LeadTopic, string> = {
  catalog_order: "Katalogdan buyurtma",
  custom_order: "Yasatma buyurtma",
  photo_request: "Rasm bo'yicha so'rov",
  question: "Savol",
  other: "Boshqa mavzu",
};

/** Har mavzuga o'z tusi — mavjud badge oilasidagi ranglardan (qattiq rang yo'q). */
export const TOPIC_HUE: Record<LeadTopic, string> = {
  catalog_order: "var(--primary)",
  custom_order: "#b3873a",
  photo_request: "#6a6ac2",
  question: "#4a7ab5",
  other: "var(--muted)",
};

const TOPICS: LeadTopic[] = ["catalog_order", "custom_order", "photo_request", "question", "other"];

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/**
 * ⚠️ `details.topic || null` — spec shunday o'qishni talab qiladi.
 * Bo'sh satr, yo'q kalit, notanish qiymat — hammasi `null`. Notanish qiymatni
 * chizsak ekranda xom kod (`custom_order` kabi) chiqib qolardi.
 */
export function leadTopic(details: unknown): LeadTopic | null {
  const t = s((details as LeadDetails | null)?.topic);
  return (TOPICS as string[]).includes(t) ? (t as LeadTopic) : null;
}

export const topicLabel = (t: LeadTopic | null): string => (t ? TOPIC_LABEL[t] : "");

/**
 * `details` ni XAVFSIZ o'qish — har doim to'liq obyekt qaytadi.
 * ⚠️ Mijozning O'Z SO'ZI (`flowers_text` / `size_text` / `note`) faqat
 * bo'shliqdan tozalanadi: bosh harf qilinmaydi, qayta yozilmaydi.
 */
export function parseLeadDetails(raw: unknown): {
  topic: LeadTopic | null;
  flowersText: string;
  sizeText: string;
  note: string;
  photoUrls: string[];
  createdByAi: boolean;
} {
  const d = (raw && typeof raw === "object" ? raw : {}) as LeadDetails;
  const photos = Array.isArray(d.photo_urls) ? d.photo_urls : [];
  return {
    topic: leadTopic(d),
    flowersText: s(d.flowers_text),
    sizeText: s(d.size_text),
    note: s(d.note),
    // ⚠️ ko'pi bilan 5 ta (spec) + faqat haqiqiy http(s) havolalar
    photoUrls: photos.filter((u) => typeof u === "string" && /^https?:\/\//i.test(u.trim())).map((u) => u.trim()).slice(0, 5),
    createdByAi: s(d.created_by) === "ai_tool",
  };
}

/* ===== NARX USTUNI ===== */

export const OPERATOR_PRICE_TEXT = "Narxni operator belgilaydi";

/**
 * NARX QANDAY KO'RSATILADI.
 *
 * ⚠️ QAROR (spec faqat `custom_order` ni nomlaydi, qolganini biz hal qildik):
 *   custom_order / photo_request / question / other → «Narxni operator belgilaydi»
 *      AI bu to'rttasiga ATAYLAB narx qo'ymaydi — narx qo'yish operatorning ishi.
 *      «—» chizsak, bu «ma'lumot yetishmayapti» bo'lib o'qilardi, holbuki bu
 *      bajarilishi kerak bo'lgan VAZIFA.
 *   catalog_order → «—»
 *      Bu yerda AI narxni ANIQ biladi; null bo'lsa bu normal oqim emas, nosozlik.
 *      Uni «operator belgilaydi» deb bezash haqiqiy muammoni yashirardi.
 *   mavzusiz (eski va qo'lda yaratilgan leadlar) → «—»
 *      Eski leadlar AYNAN avvalgidek ko'rinadi.
 *
 * Narx bor bo'lsa — doim o'sha ko'rsatiladi, mavzudan qat'i nazar.
 */
export type LeadPriceDisplay = { kind: "price"; amount: number } | { kind: "operator" } | { kind: "none" };

const NEEDS_OPERATOR: LeadTopic[] = ["custom_order", "photo_request", "question", "other"];

export function leadPriceDisplay(estimatedPrice: string | number | null | undefined, topic: LeadTopic | null): LeadPriceDisplay {
  const n = estimatedPrice == null || estimatedPrice === "" ? 0 : Number(estimatedPrice);
  if (Number.isFinite(n) && n > 0) return { kind: "price", amount: n };
  return topic && NEEDS_OPERATOR.includes(topic) ? { kind: "operator" } : { kind: "none" };
}

/** ⚠️ Muddati o'tgan rasm uchun AYNAN spec matni. */
export const PHOTO_EXPIRED_TEXT = "Rasm muddati o'tgan, mijozdan qayta so'rang";
