import { describe, expect, it } from "vitest";
import { chatHref, conversationIdFromLeads, customerSearchTerm, pickCustomerConversation } from "./customerChat";
import type { Conversation, Lead } from "./types";

const lead = (id: number, customer: number, conversation: number | null, created_at: string): Lead =>
  ({ id, customer, conversation, created_at } as unknown as Lead);
const conv = (id: number, customer: number | null, last_message_at: string | null): Conversation =>
  ({ id, customer, last_message_at } as unknown as Conversation);

describe("conversationIdFromLeads", () => {
  it("shu mijozning ENG YANGI suhbatli leadi", () => {
    const rows = [
      lead(1, 5, 100, "2026-08-01T10:00:00Z"),
      lead(2, 5, 200, "2026-09-01T10:00:00Z"),
      lead(3, 9, 300, "2026-09-02T10:00:00Z"),
    ];
    expect(conversationIdFromLeads(rows, 5)).toBe(200);
  });
  it("suhbatsiz leadlar e'tiborga olinmaydi", () => {
    expect(conversationIdFromLeads([lead(1, 5, null, "2026-09-01T10:00:00Z")], 5)).toBeNull();
    expect(conversationIdFromLeads([lead(1, 5, 0, "2026-09-01T10:00:00Z")], 5)).toBeNull();
  });
  it("bo'sh/none — null", () => {
    expect(conversationIdFromLeads([], 5)).toBeNull();
    expect(conversationIdFromLeads(null, 5)).toBeNull();
  });
});

describe("customerSearchTerm", () => {
  it("username ustuvor, so'ng telefon, so'ng ism", () => {
    expect(customerSearchTerm({ instagram_username: "aziza_gul", phone: "+998901112233", name: "Aziza" })).toBe("aziza_gul");
    expect(customerSearchTerm({ instagram_username: "", phone: "+998901112233", name: "Aziza" })).toBe("+998901112233");
    expect(customerSearchTerm({ instagram_username: "", phone: "", name: " Aziza " })).toBe("Aziza");
    expect(customerSearchTerm({ instagram_username: "", phone: "", name: "" })).toBe("");
  });
});

describe("pickCustomerConversation", () => {
  it("⚠️ FAQAT shu mijozniki — qidiruv boshqasini qaytarsa tushib qoladi", () => {
    const rows = [conv(1, 9, "2026-09-03T10:00:00Z"), conv(2, 5, "2026-09-01T10:00:00Z")];
    expect(pickCustomerConversation(rows, 5)?.id).toBe(2);
  });
  it("bir nechta bo'lsa — eng yangi xabarlisi", () => {
    const rows = [conv(1, 5, "2026-08-01T10:00:00Z"), conv(2, 5, "2026-09-03T10:00:00Z")];
    expect(pickCustomerConversation(rows, 5)?.id).toBe(2);
  });
  it("mos kelmasa null", () => {
    expect(pickCustomerConversation([conv(1, 9, null)], 5)).toBeNull();
    expect(pickCustomerConversation(null, 5)).toBeNull();
  });
});

describe("chatHref", () => {
  it("chuqur havola", () => expect(chatHref(2159)).toBe("/chat?conversation_id=2159"));
});
