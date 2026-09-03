import type { Conversation, Customer, Lead } from "./types";

/**
 * MIJOZ → SUHBAT bog'lanishi.
 *
 * ⚠️ Serverda TO'G'RIDAN-TO'G'RI yo'l yo'q: `/api/conversations/` da `customer`
 * filtri YO'Q (jonli tekshiruv: `?customer=1` ham, `?customer=999999` ham
 * 1601 ta qaytaradi — e'tiborsiz qoladi), `Customer` serializerida esa
 * `conversation` maydoni umuman yo'q.
 *
 * ⚠️ Ilgari ClientModal butun ro'yxatni tortib (`api.conversations()`) ichidan
 * qidirardi. 1601 ta suhbat, har biri BUTUN `messages` massivi bilan keladi
 * (≈88 KB/qator) — bitta sahifa 22 s, ya'ni 20 s timeout'dan oshardi.
 * Natijada suhbat HECH QACHON topilmasdi va «Chatga o'tish» tugmasi
 * umuman chizilmasdi.
 *
 * Ikki arzon yo'l:
 *   1) LEAD orqali — `Lead.conversation` bor va leadlar allaqachon yuklangan;
 *   2) SERVER QIDIRUVI — `?search=` ishlaydi, natija `customer` bo'yicha
 *      tasdiqlanadi (qidiruv fuzzy: boshqa mijoz tushib qolmasin).
 */

/** Mijozning leadlari ichidan eng yangi suhbat id si. */
export function conversationIdFromLeads(leads: Lead[] | null | undefined, customerId: number): number | null {
  const hit = (leads ?? [])
    .filter((l) => l.customer === customerId && typeof l.conversation === "number" && l.conversation > 0)
    .sort((a, b) => String(b.created_at ?? "").localeCompare(String(a.created_at ?? "")))[0];
  return hit?.conversation ?? null;
}

/** Server qidiruvi uchun eng aniq kalit: @username → telefon → ism. */
export function customerSearchTerm(c: Pick<Customer, "instagram_username" | "phone" | "name">): string {
  return (c.instagram_username || c.phone || c.name || "").trim();
}

/**
 * Qidiruv natijasidan AYNAN shu mijozning suhbati.
 * ⚠️ `customer` mos kelishi SHART — `?search=` boshqa mijozni ham qaytarishi
 * mumkin (ism/username o'xshash bo'lsa). Bir nechta bo'lsa — eng yangisi.
 */
export function pickCustomerConversation(rows: Conversation[] | null | undefined, customerId: number): Conversation | null {
  const mine = (rows ?? []).filter((c) => c.customer === customerId);
  if (!mine.length) return null;
  return mine.sort((a, b) => String(b.last_message_at ?? "").localeCompare(String(a.last_message_at ?? "")))[0];
}

/** AI chatlar sahifasiga chuqur havola (chat sahifasi `conv` va `conversation_id` ni ham o'qiydi). */
export const chatHref = (conversationId: number): string => `/chat?conversation_id=${conversationId}`;
