import type { Conversation } from "./types";

/**
 * AI CHAT — suhbatlar ro'yxati (sahifalab yuklash).
 *
 * ⚠️ NEGA KERAK: jonli bazada 1366 ta suhbat bor. Ilgari ro'yxat umumiy
 * `list()` yordamchisi bilan olinardi — u `page_size=100` bilan boshlab
 * `next` ni ergashtiradi, lekin GUARD = 4, ya'ni ENG KO'PI 500 ta suhbat
 * kelardi. Qolgan 866 tasiga umuman yetib bo'lmasdi, ustiga har 30 soniyalik
 * yangilanishda BESHTA so'rov ketardi.
 *
 * ⚠️ NEGA 100 EMAS, 30: ro'yxat endpointi HAR BIR qatorga suhbatning BUTUN
 * `messages` massivini qo'shib yuboradi (jonli o'lchov 29.08.2026: bitta qator
 * ≈ 88 KB, shundan 87 KB — 37 ta xabar). Shu bois:
 *     page_size=100 → 2.4 MB, 22.5 s  ← lib/api dagi 20 s TIMEOUT dan OSHADI
 *     page_size=50  → 1.0 MB,  7.8 s
 *     page_size=30  → 0.6 MB,  ~2 s
 * Ya'ni 100 talik so'rov UMUMAN yetib kelmasdi va ro'yxat bo'sh qolardi —
 * «ma'lumot kelmayapti» shikoyatining asl sababi shu.
 *
 * Qidiruv SERVERDA (`?search=` jonli ishlaydi: "aziza" → 5 ta), shuning uchun
 * operator butun bazadan qidiradi, faqat yuklangan qatorlardan emas.
 */

export const CHAT_PAGE_SIZE = 30;

export type ChatListFilters = {
  /** server filtri: ai | operator | closed */
  status?: string;
  /** server qidiruvi — ism yoki @username */
  search?: string;
  page?: number;
};

/**
 * So'rov parametrlari.
 * ⚠️ `source` (platforma) YUBORILMAYDI — jonli tekshiruvda server uni
 * E'TIBORSIZ qoldiradi (`?source=abrakadabra` ham 1366 ta qaytaradi),
 * shuning uchun platforma filtri klientda qoladi.
 */
export function chatListQuery(f: ChatListFilters): Record<string, string | number> {
  const q: Record<string, string | number> = {
    ordering: "-last_message_at",
    page_size: CHAT_PAGE_SIZE,
  };
  if (f.status) q.status = f.status;
  const s = (f.search ?? "").trim();
  if (s) q.search = s;
  if (f.page && f.page > 1) q.page = f.page;
  return q;
}

const timeOf = (c: Pick<Conversation, "last_message_at">): number => {
  const t = c.last_message_at ? Date.parse(c.last_message_at) : NaN;
  return Number.isFinite(t) ? t : -Infinity;   // vaqtsiz suhbat — eng oxirida
};

/** Serverdagi tartib: oxirgi xabar YANGISI birinchi; teng bo'lsa katta id birinchi. */
export const compareConversations = (a: Conversation, b: Conversation): number =>
  timeOf(b) - timeOf(a) || b.id - a.id;

/**
 * Yuklangan ro'yxatga yangi sahifani QO'SHISH.
 *
 * ⚠️ Takrorlanmaydi: 30 soniyalik yangilanish 1-sahifani qayta oladi va
 * yangi xabar kelgan suhbat tepaga ko'chadi — o'sha yozuv ro'yxatning
 * quyisida ham turgan bo'lishi mumkin. `id` bo'yicha birlashtirib, YANGI
 * nusxani qoldiramiz va qayta tartiblaymiz.
 */
export function mergeConversations(prev: Conversation[], incoming: Conversation[]): Conversation[] {
  if (!incoming.length) return prev;
  const byId = new Map<number, Conversation>();
  prev.forEach((c) => byId.set(c.id, c));
  incoming.forEach((c) => byId.set(c.id, c));
  const out: Conversation[] = [];
  byId.forEach((c) => out.push(c));
  return out.sort(compareConversations);
}

/** Yana sahifa bormi — serverning `has_next`/`total_pages` idan (ikkalasi ham bo'lmasa `next`). */
export function hasMoreConversations(
  body: { has_next?: boolean; total_pages?: number; next?: string | null } | null | undefined,
  page: number,
): boolean {
  if (!body) return false;
  if (typeof body.has_next === "boolean") return body.has_next;
  if (typeof body.total_pages === "number") return page < body.total_pages;
  return !!body.next;
}

/** «100 / 1366» ko'rinishidagi holat satri. */
export function chatCountLabel(shown: number, total: number): string {
  if (!total) return "";
  return shown >= total ? `${total} ta suhbat` : `${shown} / ${total} ta suhbat`;
}
