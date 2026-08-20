import { describe, it, expect } from "vitest";
import { readDeepLinkConv, chatUrlFor } from "./chatDeepLink";

// euroflowers_ai_media_handoff_frontend.md — Telegram tugmasi:
// https://euroflowers.cognilabs.org/chat?conversation_id=<conversation_id>

describe("DL1 — handoff havolasi", () => {
  it("?conversation_id=274 → 274", () => {
    expect(readDeepLinkConv("?conversation_id=274")).toBe(274);
  });

  it("boshqa paramlar bilan aralash kelsa ham topiladi", () => {
    expect(readDeepLinkConv("?utm_source=telegram&conversation_id=270&x=1")).toBe(270);
  });

  it("eski `?conv=` havolasi ishlashda davom etadi", () => {
    expect(readDeepLinkConv("?conv=269")).toBe(269);
  });

  it("ikkalasi kelsa `conversation_id` ustun (Telegram havolasi)", () => {
    expect(readDeepLinkConv("?conv=1&conversation_id=274")).toBe(274);
  });
});

describe("DL2 — yaroqsiz qiymat suhbat ochmaydi (server 404 berardi)", () => {
  it.each(["", "?", "?conv=", "?conversation_id=abc", "?conversation_id=0", "?conversation_id=-3", "?conversation_id=12.5", "?conversation_id=274abc"])(
    "%s → null",
    (s) => { expect(readDeepLinkConv(s)).toBeNull(); },
  );

  it("null/undefined → null", () => {
    expect(readDeepLinkConv(null)).toBeNull();
    expect(readDeepLinkConv(undefined)).toBeNull();
  });
});

describe("DL3 — URL normallashtirish", () => {
  it("ochiq suhbat qisqa ko'rinishga tushadi", () => {
    expect(chatUrlFor(274)).toBe("/chat?conv=274");
  });

  it("suhbat yopilsa toza /chat", () => {
    expect(chatUrlFor(null)).toBe("/chat");
  });

  it("yozilgan URL qayta o'qilganda o'sha id chiqadi (aylanma tekshiruv)", () => {
    const url = chatUrlFor(274);
    expect(readDeepLinkConv(url.slice(url.indexOf("?")))).toBe(274);
  });
});
