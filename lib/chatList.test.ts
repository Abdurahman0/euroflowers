import { describe, expect, it } from "vitest";
import {
  CHAT_PAGE_SIZE, chatCountLabel, chatListQuery, compareConversations, hasMoreConversations, mergeConversations,
} from "./chatList";
import type { Conversation } from "./types";

const c = (id: number, at: string | null): Conversation =>
  ({ id, last_message_at: at } as unknown as Conversation);

describe("chatListQuery", () => {
  it("birinchi sahifa — page yuborilmaydi", () => {
    expect(chatListQuery({})).toEqual({ ordering: "-last_message_at", page_size: 30 });
  });
  it("holat va qidiruv SERVERGA ketadi (jonli: ?search=aziza → 5 ta)", () => {
    expect(chatListQuery({ status: "operator", search: "  aziza  ", page: 3 })).toEqual({
      ordering: "-last_message_at", page_size: 30, status: "operator", search: "aziza", page: 3,
    });
  });
  it("bo'sh qidiruv qo'shilmaydi", () => {
    expect(chatListQuery({ search: "   " })).not.toHaveProperty("search");
  });
  it("⚠️ `source` UMUMAN yuborilmaydi — server uni e'tiborsiz qoldiradi", () => {
    expect(Object.keys(chatListQuery({ status: "ai", search: "x", page: 2 }))).toEqual(
      ["ordering", "page_size", "status", "search", "page"],
    );
  });
  /** ⚠️ 100 EMAS: ro'yxat qatorlari butun `messages` bilan keladi (≈88 KB/qator),
      100 talik so'rov 22.5 s ketib, 20 s timeout'ga urilardi. */
  it("sahifa hajmi 30 — 20 s timeout ostida qoladi", () => expect(CHAT_PAGE_SIZE).toBe(30));
});

describe("compareConversations", () => {
  it("yangi xabar birinchi", () => {
    const rows = [c(1, "2026-08-01T10:00:00Z"), c(2, "2026-08-29T10:00:00Z")].sort(compareConversations);
    expect(rows.map((r) => r.id)).toEqual([2, 1]);
  });
  it("vaqti yo'q suhbat eng oxirida", () => {
    const rows = [c(1, null), c(2, "2026-08-01T10:00:00Z")].sort(compareConversations);
    expect(rows.map((r) => r.id)).toEqual([2, 1]);
  });
  it("vaqt teng bo'lsa katta id birinchi", () => {
    const t = "2026-08-29T10:00:00Z";
    expect([c(5, t), c(9, t)].sort(compareConversations).map((r) => r.id)).toEqual([9, 5]);
  });
});

describe("mergeConversations", () => {
  it("keyingi sahifa oxiriga qo'shiladi", () => {
    const prev = [c(3, "2026-08-29T12:00:00Z"), c(2, "2026-08-29T11:00:00Z")];
    const next = [c(1, "2026-08-29T10:00:00Z")];
    expect(mergeConversations(prev, next).map((r) => r.id)).toEqual([3, 2, 1]);
  });
  it("⚠️ TAKRORLANMAYDI: 1-sahifa qayta kelganda yozuv IKKI marta chiqmaydi", () => {
    const prev = [c(3, "2026-08-29T12:00:00Z"), c(2, "2026-08-29T11:00:00Z"), c(1, "2026-08-29T10:00:00Z")];
    // 1-raqamli suhbatga yangi xabar keldi → u endi eng tepada
    const refreshed = [c(1, "2026-08-29T13:00:00Z"), c(3, "2026-08-29T12:00:00Z")];
    const out = mergeConversations(prev, refreshed);
    expect(out.map((r) => r.id)).toEqual([1, 3, 2]);
    expect(out).toHaveLength(3);
    expect(out[0].last_message_at).toBe("2026-08-29T13:00:00Z"); // YANGI nusxa qoldi
  });
  it("bo'sh sahifa ro'yxatni o'zgartirmaydi", () => {
    const prev = [c(1, "2026-08-29T10:00:00Z")];
    expect(mergeConversations(prev, [])).toBe(prev);
  });
});

describe("hasMoreConversations", () => {
  it("has_next ustuvor", () => {
    expect(hasMoreConversations({ has_next: true, total_pages: 1 }, 1)).toBe(true);
    expect(hasMoreConversations({ has_next: false, total_pages: 9 }, 1)).toBe(false);
  });
  it("total_pages bo'yicha (jonli: 1366 / 30 → 46 sahifa)", () => {
    expect(hasMoreConversations({ total_pages: 46 }, 45)).toBe(true);
    expect(hasMoreConversations({ total_pages: 46 }, 46)).toBe(false);
  });
  it("faqat `next` bo'lsa ham ishlaydi", () => {
    expect(hasMoreConversations({ next: "/api/conversations/?page=2" }, 1)).toBe(true);
    expect(hasMoreConversations({ next: null }, 1)).toBe(false);
  });
  it("javob yo'q → yo'q", () => expect(hasMoreConversations(null, 1)).toBe(false));
});

describe("chatCountLabel", () => {
  it("qisman yuklangan", () => expect(chatCountLabel(100, 1366)).toBe("100 / 1366 ta suhbat"));
  it("hammasi yuklangan", () => expect(chatCountLabel(1366, 1366)).toBe("1366 ta suhbat"));
  it("bo'sh", () => expect(chatCountLabel(0, 0)).toBe(""));
});
