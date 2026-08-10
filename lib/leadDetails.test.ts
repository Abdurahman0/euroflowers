import { describe, it, expect } from "vitest";
import {
  OPERATOR_PRICE_TEXT, TOPIC_LABEL, leadPriceDisplay, leadTopic, parseLeadDetails, topicLabel,
} from "./leadDetails";

/**
 * ⚠️ NEGA SINALADI: `details` sxemasi OCHIQ obyekt (jonli OpenAPI: `"details": {}`),
 * ya'ni TypeScript bu yerda hech narsani kafolatlamaydi. Eski leadlarda kalitlar
 * umuman yo'q, AI leadlarida esa bo'sh satr bo'lishi mumkin. Xato jimgina bo'ladi:
 * ekranda `undefined`, xom `custom_order` yoki narx o'rnida bo'shliq.
 */

describe("leadTopic — `details.topic || null`", () => {
  it("ma'lum qiymatlar o'qiladi", () => {
    for (const t of Object.keys(TOPIC_LABEL)) expect(leadTopic({ topic: t })).toBe(t);
  });
  it("⚠️ bo'sh satr / yo'q kalit / details yo'q → null (eski va qo'lda yaratilgan leadlar)", () => {
    expect(leadTopic({ topic: "" })).toBeNull();
    expect(leadTopic({})).toBeNull();
    expect(leadTopic(undefined)).toBeNull();
    expect(leadTopic(null)).toBeNull();
  });
  it("⚠️ NOTANISH qiymat → null (ekranga xom kod chiqmaydi)", () => {
    expect(leadTopic({ topic: "wedding_order" })).toBeNull();
    expect(leadTopic({ topic: 42 })).toBeNull();
    expect(topicLabel(leadTopic({ topic: "wedding_order" }))).toBe("");
  });
  it("yorliqlar spec'dagi o'zbekcha nomlar", () => {
    expect(topicLabel("custom_order")).toBe("Yasatma buyurtma");
    expect(topicLabel("photo_request")).toBe("Rasm bo'yicha so'rov");
    expect(topicLabel(null)).toBe("");
  });
});

describe("parseLeadDetails — hech qachon yiqilmaydi", () => {
  it("⚠️ ESKI LEAD: details umuman yo'q", () => {
    for (const raw of [undefined, null, {}, "matn", 5, []]) {
      const d = parseLeadDetails(raw);
      expect(d).toEqual({ topic: null, flowersText: "", sizeText: "", note: "", photoUrls: [], createdByAi: false });
    }
  });
  it("to'liq AI leadi", () => {
    const d = parseLeadDetails({
      created_by: "ai_tool", topic: "custom_order",
      flowers_text: "Jumila pushti atirgul", size_text: "51 dona, katta",
      photo_urls: [], note: "Tug'ilgan kunga sovg'a", catalog_items: [], stock_items: [],
    });
    expect(d.topic).toBe("custom_order");
    expect(d.flowersText).toBe("Jumila pushti atirgul");
    expect(d.sizeText).toBe("51 dona, katta");
    expect(d.note).toBe("Tug'ilgan kunga sovg'a");
    expect(d.createdByAi).toBe(true);
  });
  it("⚠️ mijozning O'Z SO'ZI o'zgartirilmaydi — bosh harf ham qilinmaydi", () => {
    const d = parseLeadDetails({ flowers_text: "  oq atirgul  ", note: "  onamga  " });
    expect(d.flowersText).toBe("oq atirgul");   // faqat bo'shliq kesiladi
    expect(d.note).toBe("onamga");
  });
  it("bo'sh matnlar bo'sh qoladi (ekranda qator CHIZILMAYDI)", () => {
    const d = parseLeadDetails({ flowers_text: "", size_text: "   ", note: null });
    expect([d.flowersText, d.sizeText, d.note]).toEqual(["", "", ""]);
  });

  describe("photo_urls", () => {
    it("bo'sh massiv / massiv emas → bo'sh", () => {
      expect(parseLeadDetails({ photo_urls: [] }).photoUrls).toEqual([]);
      expect(parseLeadDetails({ photo_urls: "http://x/a.jpg" }).photoUrls).toEqual([]);
      expect(parseLeadDetails({ photo_urls: null }).photoUrls).toEqual([]);
    });
    it("⚠️ KO'PI BILAN 5 ta (spec)", () => {
      const many = Array.from({ length: 9 }, (_, i) => `https://cdn/x${i}.jpg`);
      expect(parseLeadDetails({ photo_urls: many }).photoUrls).toHaveLength(5);
    });
    it("⚠️ faqat http(s) — buzuq qiymat <img src> ga tushmaydi", () => {
      const d = parseLeadDetails({ photo_urls: ["https://cdn/a.jpg", "javascript:alert(1)", "", null, 7, "ftp://x/b.jpg", "http://cdn/c.jpg"] });
      expect(d.photoUrls).toEqual(["https://cdn/a.jpg", "http://cdn/c.jpg"]);
    });
  });
});

describe("⚠️ NARX USTUNI — null narx qanday o'qiladi", () => {
  it("narx bor — mavzudan qat'i nazar o'sha ko'rsatiladi", () => {
    expect(leadPriceDisplay("750000", "custom_order")).toEqual({ kind: "price", amount: 750000 });
    expect(leadPriceDisplay(750000, null)).toEqual({ kind: "price", amount: 750000 });
  });

  it("⚠️ null/0 + custom_order → «Narxni operator belgilaydi» (spec)", () => {
    for (const v of [null, undefined, "", "0", 0, "0.00"]) {
      expect(leadPriceDisplay(v, "custom_order")).toEqual({ kind: "operator" });
    }
    expect(OPERATOR_PRICE_TEXT).toBe("Narxni operator belgilaydi");
  });

  /**
   * ⚠️ QAROR (spec faqat custom_order ni nomlagan):
   * AI photo_request / question / other ga ham ATAYLAB narx qo'ymaydi — operator
   * uchun ish AYNAN bir xil, shuning uchun matn ham bir xil.
   */
  it("null + photo_request / question / other → ham operator matni", () => {
    for (const t of ["photo_request", "question", "other"] as const) {
      expect(leadPriceDisplay(null, t)).toEqual({ kind: "operator" });
    }
  });

  /**
   * ⚠️ catalog_order — AI narxni ANIQ biladi. Bu yerda null NORMAL oqim emas,
   * nosozlik. «Operator belgilaydi» deb bezash muammoni yashirardi.
   */
  it("null + catalog_order → «—» (nosozlik yashirilmaydi)", () => {
    expect(leadPriceDisplay(null, "catalog_order")).toEqual({ kind: "none" });
  });

  it("⚠️ null + mavzusiz (eski/qo'lda yaratilgan lead) → «—», ya'ni AVVALGIDEK", () => {
    expect(leadPriceDisplay(null, null)).toEqual({ kind: "none" });
    expect(leadPriceDisplay("", null)).toEqual({ kind: "none" });
  });

  it("buzuq qiymat NaN chiqarmaydi", () => {
    expect(leadPriceDisplay("abrakadabra", "custom_order")).toEqual({ kind: "operator" });
    expect(leadPriceDisplay("abrakadabra", null)).toEqual({ kind: "none" });
    expect(leadPriceDisplay("-5", "custom_order")).toEqual({ kind: "operator" });
  });
});
