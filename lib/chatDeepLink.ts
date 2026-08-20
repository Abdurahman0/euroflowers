/**
 * CHAT DEEP-LINK — `/chat?conversation_id=<id>` YAGONA o'quvchisi.
 *
 * ⚠️ IKKI XIL NOM, BITTA MA'NO:
 *    • `conversation_id` — AI media handoff (euroflowers_ai_media_handoff_frontend.md):
 *      operator Telegram guruhidagi «CRM chatni ochish» tugmasi SHU nomni yuboradi.
 *    • `conv` — CRM ichidagi eski havolalar (mijoz kartasidagi «Chatga o'tish»).
 * Ikkalasi ham qabul qilinadi, aks holda Telegramdan kelgan operator eng yangi
 * suhbatga tushib, BOSHQA mijozga javob yozib yuborishi mumkin edi.
 *
 * Qiymat butun musbat son bo'lishi shart: `abc`, `0`, `-3`, `12.5` → null
 * (server bunday id uchun 404 beradi, uni oldindan to'sib qo'yamiz).
 */
export const DEEP_LINK_PARAMS = ["conversation_id", "conv"] as const;

export function readDeepLinkConv(search: string | null | undefined): number | null {
  if (!search) return null;
  const p = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  for (const key of DEEP_LINK_PARAMS) {
    const raw = p.get(key);
    if (raw == null) continue;
    const t = raw.trim();
    if (!/^\d+$/.test(t)) continue; // faqat butun son; "274abc" ham rad etiladi
    const n = Number(t);
    if (Number.isSafeInteger(n) && n > 0) return n;
  }
  return null;
}

/** Ochiq suhbat URLda ko'rinib tursin — yangilash/ulashish o'sha chatni ochadi.
    Uzun `?conversation_id=` qisqa `?conv=` ga NORMALLASHTIRILADI (tarixga yozuv qo'shmaydi). */
export const chatUrlFor = (id: number | null): string => (id == null ? "/chat" : `/chat?conv=${id}`);
