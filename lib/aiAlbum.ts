/**
 * AI KATALOG ALBOMI — `metadata.catalog_album_result` ni o'qish (sof qatlam).
 * Spec: FRONTEND_AI_ALBUM_AND_OPERATOR_API.md
 *
 * ⚠️ NEGA KERAK: bu xabar `sender: "system"` va `text: ""` bilan keladi. Chat
 * `sideOf()` uni «center» deb oladi, keyin `if (!m.text.trim()) return null` —
 * ya'ni albom UMUMAN CHIZILMAYDI. Operator mijoz nima ko'rganini bilmaydi,
 * mijoz esa «1chisi qancha» deb yozadi. Raqam↔mahsulot xaritasi shu yerda.
 *
 * ⚠️ JONLI HAQIQAT (suhbat 274, xabar 2715 — 38 mahsulot, 4 xabar):
 * item kalitlari AYNAN: catalog_id · delivered · detail · name · position · price · type
 * — ya'ni **`image_url` HECH BIR itemda YO'Q**, spec uni va'da qilsa ham.
 * Shuning uchun galereya rasmsiz ham TO'LIQ ishlashi shart: raqam + nom + narx.
 * `image_url` kelsa ishlatiladi (spec bo'yicha kelishi kerak) — kelmasa raqamli
 * plashka chiziladi. Katalog rasmini `catalog_id` orqali TORTIB OLMAYMIZ: u
 * mijozga ketgan rasm EMAS, keyin o'zgargan bo'lishi mumkin — soxta dalil bo'lardi.
 */

export type AlbumItem = {
  position: number;
  catalog_id: number | null;
  name: string;
  price: string | null;
  type: string | null;
  image_url: string | null;
  delivered: boolean;
};

export type AlbumNotSent = { label: string; reason: string | null };

export type AlbumView = {
  ok: boolean;
  sentAs: string | null;
  messagesSent: number;
  items: AlbumItem[];
  notSent: AlbumNotSent[];
  /** yetkazilmagan (delivered:false) dona */
  undelivered: number;
  /** «Katalog albomi yuborildi — 38 ta mahsulot, 4 ta xabar» */
  header: string;
};

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
const num = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : null;
};

/**
 * ⚠️ `not_sent` ning HAQIQIY shakli JONLI MA'LUMOTDA KO'RINMADI — u bo'sh massiv
 * (`[]`). Shu bois har xil ko'rinishga BARDOSHLI o'qiymiz: oddiy satr ham,
 * {name/title, reason/error/detail} obyekti ham qabul qilinadi.
 */
function readNotSent(raw: unknown): AlbumNotSent[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((x, i) => {
    if (typeof x === "string") return { label: x, reason: null };
    if (x && typeof x === "object") {
      const o = x as Record<string, unknown>;
      const label = str(o.name) ?? str(o.title) ?? str(o.catalog_name)
        ?? (num(o.catalog_id) != null ? `#${num(o.catalog_id)}` : null) ?? `№${i + 1}`;
      const reason = str(o.reason) ?? str(o.error) ?? str(o.detail) ?? str(o.message);
      return { label, reason };
    }
    return { label: `№${i + 1}`, reason: null };
  });
}

/** Xabar metadatasidan albom — albom bo'lmasa `null` (oddiy xabar sifatida qoladi). */
export function parseAlbum(metadata: unknown): AlbumView | null {
  if (!metadata || typeof metadata !== "object") return null;
  const raw = (metadata as Record<string, unknown>).catalog_album_result;
  if (!raw || typeof raw !== "object") return null;
  const a = raw as Record<string, unknown>;

  const items: AlbumItem[] = (Array.isArray(a.items) ? a.items : [])
    .filter((x): x is Record<string, unknown> => !!x && typeof x === "object")
    .map((o, i) => ({
      // pozitsiya yo'q bo'lsa massivdagi tartib (raqam HECH QACHON bo'sh qolmaydi)
      position: num(o.position) ?? i + 1,
      catalog_id: num(o.catalog_id),
      name: str(o.name) ?? "Nomsiz mahsulot",
      price: str(o.price),
      type: str(o.type),
      image_url: str(o.image_url),
      // ⚠️ FAQAT ANIQ `false` — maydon yo'q bo'lsa «yetkazilgan» deb olamiz,
      // aks holda hamma plitka jimgina xira bo'lib qolardi.
      delivered: o.delivered !== false,
    }))
    .sort((x, y) => x.position - y.position);

  const notSent = readNotSent(a.not_sent);
  const messagesSent = num(a.messages_sent) ?? 0;
  return {
    ok: a.ok !== false,
    sentAs: str(a.sent_as),
    messagesSent,
    items,
    notSent,
    undelivered: items.filter((x) => !x.delivered).length,
    header: `Katalog albomi yuborildi — ${items.length} ta mahsulot, ${messagesSent} ta xabar`,
  };
}

/** «album» → «albom bo'lib», «one_by_one» → «bittalab», «mixed» → «aralash» */
export const SENT_AS_LABEL: Record<string, string> = {
  album: "albom bo'lib",
  one_by_one: "bittalab",
  mixed: "aralash",
};

/* ═══════════ SOZLAMALAR — «OPERATOR ALOQASI» ═══════════ */

export type OperatorContact = {
  operator_phone: string;
  operator_hours: string;
  operator_hours_ru: string;
};

export const OPERATOR_FIELDS: (keyof OperatorContact)[] = [
  "operator_phone", "operator_hours", "operator_hours_ru",
];

/**
 * PATCH tanasi — FAQAT O'ZGARGAN kalitlar.
 *
 * ⚠️ BO'SH MAYDON QOIDASI: serverda defaultlar bor. Operator maydonni TEGMAGAN
 * bo'lsa kalit umuman yuborilmaydi. Lekin ATAYLAB tozalasa (edi «...», bo'ldi "")
 * — bu ONGLI tanlov va `""` YUBORILADI: aks holda tugma bosilsa-yu hech narsa
 * o'zgarmasdi va operator nega ishlamayotganini tushunmasdi.
 * Ya'ni «bo'sh → yubormaslik» EMAS, «o'zgarmagan → yubormaslik».
 */
export function operatorPayload(
  initial: Partial<OperatorContact> | null | undefined,
  draft: OperatorContact,
): Partial<OperatorContact> {
  const out: Partial<OperatorContact> = {};
  for (const k of OPERATOR_FIELDS) {
    const was = (initial?.[k] ?? "").trim();
    const now = (draft[k] ?? "").trim();
    if (was !== now) out[k] = now;
  }
  return out;
}

/** Bironta maydon o'zgardimi (Saqlash tugmasi shunga qarab yonadi) */
export const operatorDirty = (
  initial: Partial<OperatorContact> | null | undefined, draft: OperatorContact,
): boolean => Object.keys(operatorPayload(initial, draft)).length > 0;
