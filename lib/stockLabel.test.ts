import { describe, it, expect } from "vitest";
import { batchTitle, batchTitleNoHeight, flowerName, variantName, variantColor, isGeneralVariant } from "./stockLabel";

/** JONLI shakl 1 — ESKI partiya, haqiqiy nav (stock-batches, 2026-08-08) */
const legacy = {
  title: "Atirgul · Prut · Oq 80 sm",
  flower_name: "Atirgul",
  height_label: "80 sm",
  flower_detail: { id: 20, name_uz: "Atirgul" },
  variant_detail: { id: 5, name_uz: "Prut", color_uz: "Oq", is_general: false, flower_detail: { name_uz: "Atirgul" } },
};

/** KONTRAKT shakl 2 — YANGI «general» qator (jonli bazada hali YO'Q) */
const general = {
  title: "Atirgul 40 sm",
  flower_name: "Atirgul",
  height_label: "40 sm",
  flower_detail: { id: 20, name_uz: "Atirgul" },
  variant_detail: { id: 99, name_uz: "", color_uz: "", is_general: true, flower_detail: { name_uz: "Atirgul" } },
};

/** JONLI shakl 3 — YUPQA balans shakli (florist-stock-balances.batch_detail): `title` YO'Q */
const flatLegacy = { flower: "Atirgul", variant: "Prut", color: "Oq", height_label: "80 sm", batch_number: "EF-1" };
const flatGeneral = { flower: "Atirgul", variant: "", color: "", height_label: "40 sm", batch_number: "EF-2" };

describe("isGeneralVariant", () => {
  it("eski — haqiqiy nav", () => expect(isGeneralVariant(legacy)).toBe(false));
  it("yangi — is_general:true", () => expect(isGeneralVariant(general)).toBe(true));
  it("nomlari bo'sh bo'lsa ham general deb qaraladi (bayroq yo'q eski javob)", () => {
    expect(isGeneralVariant({ variant_detail: { name_uz: "", name_ru: "" } })).toBe(true);
  });
  it("yupqa shakl: `variant` bo'sh → general", () => {
    expect(isGeneralVariant(flatGeneral)).toBe(true);
    expect(isGeneralVariant(flatLegacy)).toBe(false);
  });
});

describe("batchTitle — SERVER `title` USTUN", () => {
  it("eski qator — nav va rang KO'RINADI", () => {
    expect(batchTitle(legacy)).toBe("Atirgul · Prut · Oq 80 sm");
  });
  it("yangi qator — nav yo'q, OSILGAN AJRATGICH ham yo'q", () => {
    expect(batchTitle(general)).toBe("Atirgul 40 sm");
  });
  it("⚠️ ASL NOSOZLIK: `title` bo'lmasa ham osilgan « · » chiqmaydi", () => {
    const noTitle = { ...general, title: undefined };
    const out = batchTitle(noTitle);
    expect(out).toBe("Atirgul 40 sm");
    expect(out).not.toContain("·");
    expect(out).not.toMatch(/\s{2,}/);
  });
  it("⚠️ YUPQA shakl (balans) — general qatorda ham toza", () => {
    expect(batchTitle(flatGeneral)).toBe("Atirgul 40 sm");
    expect(batchTitle(flatGeneral)).not.toContain("·");
    expect(batchTitle(flatLegacy)).toBe("Atirgul · Prut · Oq 80 sm");
  });
  it("bo'sh/null — zaxira matn", () => {
    expect(batchTitle(null)).toBe("Gul");
    expect(batchTitle({})).toBe("Gul");
    expect(batchTitle({}, "Partiya")).toBe("Partiya");
  });
  it("faqat gul nomi bor — bo'ysiz ham to'g'ri", () => {
    expect(batchTitle({ flower_name: "Xrizantema" })).toBe("Xrizantema");
  });
});

describe("flowerName / variantName / variantColor", () => {
  it("gul nomi uchala shakldan ham olinadi", () => {
    expect(flowerName(legacy)).toBe("Atirgul");
    expect(flowerName(general)).toBe("Atirgul");
    expect(flowerName(flatGeneral)).toBe("Atirgul");
    expect(flowerName({ variant_detail: { flower_detail: { name_uz: "Lola" } } })).toBe("Lola");
  });
  it("⚠️ nav va rang FAQAT eski qatorda — yangida BO'SH", () => {
    expect(variantName(legacy)).toBe("Prut");
    expect(variantColor(legacy)).toBe("Oq");
    expect(variantName(general)).toBe("");
    expect(variantColor(general)).toBe("");
    expect(variantName(flatGeneral)).toBe("");
  });
});

describe("batchTitleNoHeight — bo'y alohida ustunda bo'lganda", () => {
  it("eski", () => expect(batchTitleNoHeight(legacy)).toBe("Atirgul · Prut · Oq"));
  it("yangi — faqat gul", () => expect(batchTitleNoHeight(general)).toBe("Atirgul"));
  it("title'dan bo'y kesiladi (nomlar yo'q bo'lsa)", () => {
    expect(batchTitleNoHeight({ title: "Atirgul 40 sm", height_label: "40 sm" })).toBe("Atirgul");
  });
  it("zaxira matn — bo'sh partiyada chaqiruvchi bergani", () => {
    expect(batchTitleNoHeight(undefined, "#12")).toBe("#12");
  });
});

/**
 * ⚠️ EKRANDAGI HAQIQIY SHABLONLAR — har biri BURUN qo'lda yig'ilgan va «general»
 * qatorda osilgan ajratgich berardi. Bu yerda AYNAN o'sha satrlar sinaladi.
 */
describe("chaqiruv joylaridagi shablonlar — osilgan ajratgich YO'Q", () => {
  const clean = (s: string) => {
    expect(s).not.toMatch(/^\s*[·—]|[·—]\s*$/);   // boshida/oxirida ajratgich
    expect(s).not.toMatch(/[·—]\s*[·—]/);          // ketma-ket ajratgich
    expect(s).not.toMatch(/\s{2,}/);               // qo'sh bo'shliq
    return s;
  };

  it("BatchDrawer sarlavhasi", () => {
    expect(clean(batchTitleNoHeight(general))).toBe("Atirgul");
    expect(clean(batchTitleNoHeight(legacy))).toBe("Atirgul · Prut · Oq");
  });
  it("BatchEditModal / BatchMovementModal sub («… · №EF-1»)", () => {
    expect(clean(`${batchTitleNoHeight(general)} · №EF-2`)).toBe("Atirgul · №EF-2");
  });
  it("SupplierModal harakatlar jurnali («Chiqit · …»)", () => {
    // ⚠️ ilgari `variant_detail?.name_uz ?? '#id'` edi — BO'SH SATR `??` dan O'TIB KETARDI
    expect(clean(`Chiqit · ${batchTitleNoHeight(general)}`)).toBe("Chiqit · Atirgul");
    expect(batchTitleNoHeight({ variant_detail: { name_uz: "", is_general: true } }, "#7")).toBe("#7");
  });
  it("KatalogViewModal tarkibi («🌸 …»)", () => {
    expect(clean(`🌸 ${batchTitleNoHeight(general)}`)).toBe("🌸 Atirgul");
  });
  it("FloristCompositionPicker — YUPQA balans shakli", () => {
    expect(clean(batchTitleNoHeight(flatGeneral, "Partiya #9"))).toBe("Atirgul");
  });
  it("CatalogRestoreDrawer tanlagichi («… · №EF · 100 dona»)", () => {
    expect(clean(`${batchTitleNoHeight(general)} · №EF-2 · 100 dona`)).toBe("Atirgul · №EF-2 · 100 dona");
  });
  it("⚠️ ID NOM BO'LIB CHIQMAYDI — to'liq partiyada `variant` RAQAM (FK)", () => {
    // yupqa shaklda `variant` NOM, to'liqda esa ID — bir xil kalit, ikki xil ma'no
    expect(batchTitleNoHeight({ flower_name: "Atirgul", variant: 12 })).toBe("Atirgul");
  });
});
