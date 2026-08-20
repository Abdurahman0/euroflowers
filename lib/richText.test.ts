import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import RichText from "@/components/chat/RichText";

// AI media handoff: mijozning havolasi pufak ichida BOSILADIGAN bo'lishi kerak.
// (JSX'siz — vitest konfiguratsiyasi faqat lib/**/*.test.ts ni oladi.)
const html = (text: string, tone?: "plain" | "brand") =>
  renderToStaticMarkup(createElement(RichText, { text, tone }));

describe("RT1 — havola <a> bo'lib chiziladi", () => {
  it("yangi oynada, referrer'siz ochiladi", () => {
    const out = html("Mana: https://www.instagram.com/stories/euroflowers/123");
    expect(out).toContain('href="https://www.instagram.com/stories/euroflowers/123"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noreferrer"');
  });

  it("yorliq qisqartirilgan, to'liq manzil title'da qoladi", () => {
    const url = `https://cdn.example.com/${"a".repeat(80)}.jpg`;
    const out = html(`rasm ${url}`);
    expect(out).toContain(`title="${url}"`);
    expect(out).toContain("…"); // ko'rinadigan yorliq qisqargan
  });

  it("havolasiz matnda <a> umuman yo'q", () => {
    expect(html("Salom, narxi qancha?")).not.toContain("<a ");
  });

  it("bo'sh matn hech nima chizmaydi", () => {
    expect(html("")).toBe("");
  });
});

describe("RT2 — brend pufagida rang meros qilib olinadi", () => {
  it("brand: color inherit (primary ko'k rang brend fonida ko'rinmasdi)", () => {
    expect(html("https://a.uz/x", "brand")).toContain("color:inherit");
  });

  it("plain: primary rangi", () => {
    expect(html("https://a.uz/x", "plain")).toContain("var(--primary)");
  });
});
