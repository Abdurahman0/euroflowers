import { describe, it, expect } from "vitest";
import { groupCatalog, pickSellItem, uniformPrice, splitCatalogView, volumesInGroup } from "./catalogGroups";
import type { CatalogItem } from "./types";

// Do'kon ma'lumoti (jonli, 20.08.2026): 6 ta KATTA buket — hammasi 800 000 so'm,
// nomlari har xil («kotta», «KOTTA 100 TALI ATIR»…). Operator uchun bu BITTA tovar.
const item = (p: Partial<CatalogItem> & { id: number }): CatalogItem =>
  ({
    name_uz: `#${p.id}`, name_ru: "", price: "0", status: "available",
    arrangement_type: "bouquet", quantity_total: 1, quantity_sold: 0,
    ...p,
  } as CatalogItem);

describe("CG1 — hajm VA tur bo'yicha guruhlash", () => {
  const items = [
    item({ id: 518, volume: "large", price: "800000", quantity_total: 7 }),
    item({ id: 542, volume: "large", price: "800000", quantity_total: 2 }),
    item({ id: 540, volume: "small", price: "200000", quantity_total: 16 }),
    item({ id: 536, volume: "medium", price: "1000000", quantity_total: 4, arrangement_type: "basket" }),
    item({ id: 537, volume: "medium", price: "400000", quantity_total: 5 }),
  ];

  it("SAVAT buketdan alohida, ammo HAJM bo'yicha bo'linmaydi — bitta «Savat» kartasi", () => {
    const gs = groupCatalog(items);
    expect(gs.map((g) => g.label)).toEqual(["Kichik buket", "O'rta buket", "Katta buket", "Savat"]);
  });

  it("har xil hajmdagi savatlar BITTA kartada yig'iladi", () => {
    const gs = groupCatalog([
      item({ id: 1, volume: "small", arrangement_type: "basket", quantity_total: 4 }),
      item({ id: 2, volume: "medium", arrangement_type: "basket", quantity_total: 1 }),
      item({ id: 3, volume: "large", arrangement_type: "basket", quantity_total: 2 }),
    ]);
    expect(gs).toHaveLength(1);
    expect(gs[0].label).toBe("Savat");
    expect(gs[0].remaining).toBe(7);
    expect(volumesInGroup(gs[0].items)).toEqual(["small", "medium", "large"]);
  });

  it("har bir guruhda BITTA tur", () => {
    for (const g of groupCatalog(items)) {
      expect(new Set(g.items.map((k) => k.arrangement_type ?? "bouquet")).size).toBe(1);
    }
  });

  it("savat va buket sonlari ARALASHMAYDI", () => {
    const gs = groupCatalog(items);
    const savat = gs.find((g) => g.key === "|basket")!;
    const buket = gs.find((g) => g.key === "medium|bouquet")!;
    expect(savat.remaining).toBe(4);
    expect(buket.remaining).toBe(5);
    expect(uniformPrice(savat)).toBe(1000000);
    expect(uniformPrice(buket)).toBe(400000);
  });

  it("bir xil hajm+turdagi yozuvlar bitta kartaga yig'iladi", () => {
    const large = groupCatalog(items).find((g) => g.key === "large|bouquet")!;
    expect(large.items.map((k) => k.id).sort()).toEqual([518, 542]);
    expect(large.remaining).toBe(9);
  });

  it("tartib: kichik → o'rta → katta, ichida buket → savat → quti", () => {
    const gs = groupCatalog([
      item({ id: 1, volume: "large", arrangement_type: "basket" }),
      item({ id: 2, volume: "small", arrangement_type: "box" }),
      item({ id: 3, volume: "small", arrangement_type: "bouquet" }),
      item({ id: 4, volume: "large", arrangement_type: "bouquet" }),
    ]);
    // buketlar hajm bo'yicha, savat/quti bittadan (hajmsiz kalit)
    expect(gs.map((g) => g.key)).toEqual(["small|bouquet", "large|bouquet", "|basket", "|box"]);
  });

  it("sotilib bo'lgan yozuv narx oralig'ini kengaytirmaydi", () => {
    const gs = groupCatalog([
      item({ id: 1, volume: "small", price: "200000", quantity_total: 5 }),
      item({ id: 2, volume: "small", price: "999000", quantity_total: 3, quantity_sold: 3 }),
    ]);
    expect(gs[0].prices).toEqual([200000]);
    expect(gs[0].remaining).toBe(5);
  });
});

describe("CG2 — hajmsiz yozuvlar YO'QOLMAYDI", () => {
  it("bo'sh/notanish hajm oxirgi guruhga tushadi", () => {
    const gs = groupCatalog([
      item({ id: 1, volume: "large" }),
      item({ id: 2, volume: "" as never }),
      item({ id: 3, volume: "XXL" as never }),
    ]);
    expect(gs.map((g) => g.key)).toEqual(["large|bouquet", "|bouquet"]);
    expect(gs[1].label).toBe("Hajmi belgilanmagan buket");
    expect(gs[1].items.map((k) => k.id)).toEqual([2, 3]);
  });

  it("bo'sh ro'yxat → guruh yo'q", () => {
    expect(groupCatalog([])).toEqual([]);
  });
});

describe("CG3 — «qaysi biridan yechilishi muhim emas» tanlovi", () => {
  it("qoldig'i eng ko'p pozitsiya tanlanadi", () => {
    const chosen = pickSellItem([
      item({ id: 542, quantity_total: 2 }),
      item({ id: 518, quantity_total: 7 }),
      item({ id: 541, quantity_total: 2 }),
    ]);
    expect(chosen?.id).toBe(518);
  });

  it("teng bo'lsa — eskisi (kichik id)", () => {
    expect(pickSellItem([item({ id: 9, quantity_total: 3 }), item({ id: 4, quantity_total: 3 })])?.id).toBe(4);
  });

  it("qoldig'i tugagan yozuv tanlanmaydi", () => {
    expect(pickSellItem([item({ id: 1, quantity_total: 2, quantity_sold: 2 })])).toBeNull();
  });

  it("chiqit va restavratsiya qoldiqdan chiqariladi", () => {
    const chosen = pickSellItem([
      item({ id: 1, quantity_total: 10, quantity_wasted: 9 }),
      item({ id: 2, quantity_total: 5, quantity_reworked: 1 }),
    ]);
    expect(chosen?.id).toBe(2);
  });
});

describe("CG4 — savat guruhlanmaydi, alohida karta bo'ladi", () => {
  const items = [
    item({ id: 540, volume: "small", arrangement_type: "bouquet" }),
    item({ id: 536, volume: "medium", arrangement_type: "basket" }),
    item({ id: 524, volume: "small", arrangement_type: "basket" }),
    item({ id: 518, volume: "large", arrangement_type: "bouquet" }),
    item({ id: 400, volume: "large", arrangement_type: "box" }),
  ];

  it("buket hajm bo'yicha, savat/quti bittadan guruhga tushadi", () => {
    const { groups } = splitCatalogView(items);
    expect(groups.map((g) => g.key)).toEqual(["small|bouquet", "large|bouquet", "|basket", "|box"]);
  });

  it("har xil hajmdagi savatlar BITTA «Savat» kartasida", () => {
    const savat = splitCatalogView(items).groups.find((g) => g.key === "|basket")!;
    expect(savat.label).toBe("Savat");
    expect(savat.items.map((k) => k.id).sort()).toEqual([524, 536]);
  });

  it("savat yo'q bo'lsa faqat buket guruhi qoladi", () => {
    const only = [item({ id: 1, volume: "small", arrangement_type: "bouquet" })];
    const { groups } = splitCatalogView(only);
    expect(groups.map((g) => g.key)).toEqual(["small|bouquet"]);
  });
});

describe("CG5 — MAXSUS (custom) katalog guruhga qo'shilmaydi", () => {
  const items = [
    item({ id: 1, volume: "large", arrangement_type: "bouquet" }),
    item({ id: 2, volume: "large", arrangement_type: "bouquet", catalog_kind: "custom" }),
    item({ id: 3, volume: "small", arrangement_type: "basket" }),
    item({ id: 4, volume: "small", arrangement_type: "basket", catalog_kind: "custom" }),
  ];

  it("custom buket guruhga TUSHMAYDI — alohida ro'yxatda", () => {
    const { groups, customs } = splitCatalogView(items);
    // guruhlarda faqat oddiy (custom BO'LMAGAN) yozuvlar: #1 buket va #3 savat
    expect(groups.flatMap((g) => g.items.map((k) => k.id)).sort()).toEqual([1, 3]);
    expect(customs.map((k) => k.id)).toEqual([4, 2]); // kichik → katta
  });

  it("custom savat oddiy SAVAT guruhiga ham tushmaydi", () => {
    const { groups } = splitCatalogView(items);
    expect(groups.find((g) => g.key === "|basket")!.items.map((k) => k.id)).toEqual([3]);
  });

  it("custom yo'q bo'lsa ro'yxat bo'sh, qolganlari guruhda", () => {
    const { groups, customs } = splitCatalogView([items[0], items[2]]);
    expect(customs).toEqual([]);
    expect(groups.map((g) => g.key)).toEqual(["large|bouquet", "|basket"]);
  });

  it("guruh sonlariga custom KIRMAYDI (qoldiq yolg'on oshmasin)", () => {
    const gs = splitCatalogView([
      item({ id: 1, volume: "large", quantity_total: 5 }),
      item({ id: 2, volume: "large", quantity_total: 7, catalog_kind: "custom" }),
    ]).groups;
    expect(gs[0].remaining).toBe(5);
  });
});

describe("CG6 — hajm SOTUVDA tanlanadi (savat kartasi bo'linmaydi)", () => {
  it("guruhdagi mavjud hajmlar kichikdan kattaga qaytariladi", () => {
    expect(volumesInGroup([
      item({ id: 1, volume: "large", quantity_total: 2 }),
      item({ id: 2, volume: "small", quantity_total: 1 }),
    ])).toEqual(["small", "large"]);
  });

  it("qoldig'i tugagan hajm tanlovda KO'RINMAYDI (sotib bo'lmaydi)", () => {
    expect(volumesInGroup([
      item({ id: 1, volume: "small", quantity_total: 3 }),
      item({ id: 2, volume: "large", quantity_total: 2, quantity_sold: 2 }),
    ])).toEqual(["small"]);
  });

  it("hajm tanlanganda SHU hajmdagi yozuv sotiladi (qoldig'i ko'pi)", () => {
    const pool = [
      item({ id: 5, volume: "large", quantity_total: 1 }),
      item({ id: 6, volume: "large", quantity_total: 4 }),
      item({ id: 7, volume: "small", quantity_total: 9 }),
    ];
    expect(pickSellItem(pool.filter((k) => k.volume === "large"))?.id).toBe(6);
  });
});
