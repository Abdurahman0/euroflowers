import { describe, it, expect } from "vitest";
import { parseAlbum, operatorPayload, operatorDirty, type OperatorContact } from "./aiAlbum";

/** JONLI shakl (suhbat 274, xabar 2715) — `image_url` YO'Q, aynan shu kalitlar */
const liveItem = (position: number, over: Record<string, unknown> = {}) => ({
  name: "MIX BUKET KOMPAZITSIYA", type: "bouquet", price: "800000.00",
  detail: "album", position, delivered: true, catalog_id: 274 - position, ...over,
});
const live = (over: Record<string, unknown> = {}) => ({
  catalog_album_result: {
    ok: true, sent_as: "album", messages_sent: 4, album_max_per_message: 10,
    numbering_visible: true, items: [liveItem(1), liveItem(2)], not_sent: [], ...over,
  },
});

describe("parseAlbum — albom bo'lmasa null", () => {
  it("metadata yo'q / bo'sh / boshqa tur", () => {
    for (const v of [null, undefined, {}, { image_tool_result: { image_url: "x" } }, "matn", 42])
      expect(parseAlbum(v)).toBeNull();
  });
  it("⚠️ `image_tool_result` albom deb O'QILMAYDI (u tegilmaydi)", () => {
    expect(parseAlbum({ image_tool_result: { image_url: "https://x/y.jpg", catalog_id: 24 } })).toBeNull();
  });
});

describe("parseAlbum — JONLI shakl", () => {
  it("sarlavha spec matni bilan", () => {
    const a = parseAlbum(live({ items: Array.from({ length: 38 }, (_, i) => liveItem(i + 1)) }))!;
    expect(a.header).toBe("Katalog albomi yuborildi — 38 ta mahsulot, 4 ta xabar");
    expect(a.items).toHaveLength(38);
    expect(a.ok).toBe(true);
    expect(a.sentAs).toBe("album");
  });
  it("⚠️ `image_url` YO'Q — plitka baribir quriladi (jonli holat)", () => {
    const a = parseAlbum(live())!;
    expect(a.items[0].image_url).toBeNull();
    expect(a.items[0].name).toBe("MIX BUKET KOMPAZITSIYA");
    expect(a.items[0].price).toBe("800000.00");
    expect(a.items[0].catalog_id).toBe(273);
  });
  it("`position` bo'yicha SARALANADI (server tartibi buzilsa ham)", () => {
    const a = parseAlbum(live({ items: [liveItem(3), liveItem(1), liveItem(2)] }))!;
    expect(a.items.map((x) => x.position)).toEqual([1, 2, 3]);
  });
  it("`position` yo'q bo'lsa massiv tartibi olinadi — raqam BO'SH qolmaydi", () => {
    const a = parseAlbum(live({ items: [{ name: "A" }, { name: "B" }] }))!;
    expect(a.items.map((x) => x.position)).toEqual([1, 2]);
  });
});

describe("parseAlbum — himoyalangan o'qish (bitta plitka buzilsa xabar YO'QOLMAYDI)", () => {
  it("nomsiz / narxsiz / turi yo'q item", () => {
    const a = parseAlbum(live({ items: [{ position: 1 }] }))!;
    expect(a.items[0]).toMatchObject({ position: 1, name: "Nomsiz mahsulot", price: null, type: null, image_url: null, catalog_id: null });
  });
  it("items yo'q / massiv emas / ichida null", () => {
    expect(parseAlbum(live({ items: undefined }))!.items).toEqual([]);
    expect(parseAlbum(live({ items: "abrakadabra" }))!.items).toEqual([]);
    expect(parseAlbum(live({ items: [null, liveItem(1)] }))!.items).toHaveLength(1);
  });
  it("bo'sh ro'yxat — sarlavha baribir chiqadi", () => {
    const a = parseAlbum(live({ items: [], messages_sent: 0 }))!;
    expect(a.header).toBe("Katalog albomi yuborildi — 0 ta mahsulot, 0 ta xabar");
  });
  it("`messages_sent` yo'q → 0 (NaN EMAS)", () => {
    expect(parseAlbum(live({ messages_sent: undefined }))!.messagesSent).toBe(0);
    expect(parseAlbum(live({ messages_sent: "4" }))!.messagesSent).toBe(4);
  });
});

describe("parseAlbum — delivered", () => {
  it("⚠️ FAQAT aniq `false` yetkazilmagan; maydon yo'q bo'lsa YETKAZILGAN", () => {
    const a = parseAlbum(live({ items: [liveItem(1, { delivered: false }), liveItem(2), { position: 3, name: "C" }] }))!;
    expect(a.items.map((x) => x.delivered)).toEqual([false, true, true]);
    expect(a.undelivered).toBe(1);
  });
});

describe("parseAlbum — ok:false va not_sent", () => {
  it("ok:false", () => {
    const a = parseAlbum(live({ ok: false }))!;
    expect(a.ok).toBe(false);
  });
  it("ok yo'q bo'lsa TRUE (galereya bekorga yashirilmaydi)", () => {
    expect(parseAlbum(live({ ok: undefined }))!.ok).toBe(true);
  });
  it("⚠️ not_sent shakli JONLIDA KO'RINMAGAN — satr ham, obyekt ham o'qiladi", () => {
    expect(parseAlbum(live({ not_sent: ["Rasm yo'q"] }))!.notSent).toEqual([{ label: "Rasm yo'q", reason: null }]);
    expect(parseAlbum(live({ not_sent: [{ name: "SAVAT", reason: "rasm yo'q" }] }))!.notSent)
      .toEqual([{ label: "SAVAT", reason: "rasm yo'q" }]);
    expect(parseAlbum(live({ not_sent: [{ catalog_id: 88, error: "timeout" }] }))!.notSent)
      .toEqual([{ label: "#88", reason: "timeout" }]);
    expect(parseAlbum(live({ not_sent: [{}] }))!.notSent).toEqual([{ label: "№1", reason: null }]);
    expect(parseAlbum(live({ not_sent: "abrakadabra" }))!.notSent).toEqual([]);
  });
});

describe("operatorPayload — FAQAT o'zgargan kalitlar", () => {
  const initial = { operator_phone: "+998 88 009 33 30", operator_hours: "08:00 dan 00:00 gacha", operator_hours_ru: "с 08:00 до 00:00" };
  const draft = (o: Partial<OperatorContact> = {}): OperatorContact => ({ ...initial, ...o });

  it("hech narsa o'zgarmagan — BO'SH tana", () => {
    expect(operatorPayload(initial, draft())).toEqual({});
    expect(operatorDirty(initial, draft())).toBe(false);
  });
  it("bitta maydon o'zgardi — FAQAT o'sha ketadi", () => {
    expect(operatorPayload(initial, draft({ operator_hours: "har kuni 08:00 - 00:00" })))
      .toEqual({ operator_hours: "har kuni 08:00 - 00:00" });
  });
  it("⚠️ ERKIN MATN — format tekshirilmaydi, AYNAN yuboriladi", () => {
    for (const v of ["har kuni 08:00 - 00:00", "24/7", "dam olishsiz, ertalabdan yarim tungacha"])
      expect(operatorPayload(initial, draft({ operator_hours: v })).operator_hours).toBe(v);
  });
  it("⚠️ ATAYLAB tozalangan maydon `\"\"` bo'lib YUBORILADI (ongli tanlov)", () => {
    expect(operatorPayload(initial, draft({ operator_hours: "" }))).toEqual({ operator_hours: "" });
  });
  it("faqat bo'shliq qo'shilsa — o'zgarish EMAS (trim solishtiriladi)", () => {
    expect(operatorPayload(initial, draft({ operator_phone: "  +998 88 009 33 30  " }))).toEqual({});
  });
  it("boshlang'ich yo'q (settings hali yuklanmagan) — to'ldirilganlari ketadi", () => {
    expect(operatorPayload(null, draft())).toEqual(initial);
    expect(operatorPayload(undefined, { operator_phone: "", operator_hours: "", operator_hours_ru: "" })).toEqual({});
  });
  it("⚠️ BOSHQA sozlama kalitlariga TEGMAYDI (working_hours / shop_phone / fee)", () => {
    const withOthers = { ...initial, working_hours: "24/7", shop_phone: "+998 90 000 00 00", default_florist_fee: "50000" };
    const out = operatorPayload(withOthers as never, draft({ operator_phone: "+998 90 111 22 33" }));
    expect(Object.keys(out)).toEqual(["operator_phone"]);
  });
});
