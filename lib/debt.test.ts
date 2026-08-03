import { describe, it, expect } from "vitest";
import {
  debtCustomerReady, debtSellPayload, debtPayPayload, canPayDebt,
  debtQtyLabel, debtNum, DEBT_CUSTOMER_REQUIRED, DEBT_ALREADY_PAID,
} from "./debt";
import type { CustomerPick } from "@/components/CustomerPicker";

// 2026-08-03 09:30 Toshkent = 2026-08-03T04:30:00Z (backdate testlari bilan bir xil asos)
const NOW = Date.parse("2026-08-03T04:30:00Z");

const none: CustomerPick = { mode: "none" };
const existing = (id: number): CustomerPick => ({ mode: "existing", id });
const fresh = (name: string, phone: string): CustomerPick => ({ mode: "new", name, phone });

describe("debtCustomerReady — qarzda mijoz MAJBURIY", () => {
  it("«Biriktirmayman» HECH QACHON yetarli emas", () => {
    expect(debtCustomerReady(none)).toBe(false);
  });
  it("mavjud mijoz tanlangan → yetarli", () => {
    expect(debtCustomerReady(existing(12))).toBe(true);
  });
  it("mavjud rejim, lekin hali tanlanmagan (id=0) → yetarli EMAS", () => {
    expect(debtCustomerReady(existing(0))).toBe(false);
  });
  it("⚠️ yangi mijoz: ISM VA TELEFON ikkalasi ham — faqat ism YETARLI EMAS", () => {
    expect(debtCustomerReady(fresh("Aziz Karimov", ""))).toBe(false);
  });
  it("⚠️ faqat telefon ham yetarli emas", () => {
    expect(debtCustomerReady(fresh("", "+998901234567"))).toBe(false);
  });
  it("ikkalasi ham bor → yetarli", () => {
    expect(debtCustomerReady(fresh("Aziz Karimov", "+998901234567"))).toBe(true);
  });
  it("faqat bo'sh joy — yetarli emas", () => {
    expect(debtCustomerReady(fresh("   ", "   "))).toBe(false);
  });
});

describe("debtSellPayload — sotuv payload'ining qarz qismi", () => {
  it("QARZ EMAS → BO'SH obyekt (naqd/karta yo'llari AYNAN ilgarigidek)", () => {
    expect(debtSellPayload(false, none, "")).toEqual({});
    expect(debtSellPayload(false, existing(12), "izoh")).toEqual({});
  });
  it("mavjud mijoz → {customer}", () => {
    expect(debtSellPayload(true, existing(12), "")).toEqual({ customer: 12 });
  });
  it("yangi mijoz → {customer_name, customer_phone} (ikkalasi)", () => {
    expect(debtSellPayload(true, fresh("Aziz Karimov", "+998901234567"), "")).toEqual({
      customer_name: "Aziz Karimov", customer_phone: "+998901234567",
    });
  });
  it("izoh berilsa → debt_note qo'shiladi", () => {
    expect(debtSellPayload(true, existing(12), "Juma kuni to'laydi")).toEqual({
      customer: 12, debt_note: "Juma kuni to'laydi",
    });
  });
  it("bo'sh izoh → debt_note kaliti YO'Q (bo'sh satr yuborilmaydi)", () => {
    expect(debtSellPayload(true, existing(12), "   ")).toEqual({ customer: 12 });
  });
  it("⚠️ mijozsiz qarz → null (submit BLOKLANADI, server 400'ini kutmaymiz)", () => {
    expect(debtSellPayload(true, none, "")).toBeNull();
    expect(debtSellPayload(true, existing(0), "")).toBeNull();
    expect(debtSellPayload(true, fresh("Aziz", ""), "")).toBeNull();
  });
  it("ism/telefon atrofidagi bo'shliqlar kesiladi", () => {
    expect(debtSellPayload(true, fresh("  Aziz  ", "  +998901234567 "), "")).toEqual({
      customer_name: "Aziz", customer_phone: "+998901234567",
    });
  });
});

describe("debtPayPayload — usul MAJBURIY, paid_at faqat o'tgan kunda", () => {
  it("usul tanlanmagan → null (sukut qiymat YO'Q)", () => {
    expect(debtPayPayload(null, null, NOW)).toBeNull();
  });
  it("naqd → {method:'cash'}, paid_at kaliti YO'Q", () => {
    expect(debtPayPayload("cash", null, NOW)).toEqual({ method: "cash" });
  });
  it("karta → {method:'card'}", () => {
    expect(debtPayPayload("card", null, NOW)).toEqual({ method: "card" });
  });
  it("BUGUN tanlangan (= sukut) → paid_at YUBORILMAYDI", () => {
    expect(debtPayPayload("cash", "2026-08-03", NOW)).toEqual({ method: "cash" });
  });
  it("⚠️ O'TGAN kun → paid_at DOIM +05:00 bilan", () => {
    expect(debtPayPayload("card", "2026-07-28", NOW)).toEqual({
      method: "card", paid_at: "2026-07-28T12:00:00+05:00",
    });
  });
  it("natijada 'Z' BO'LMAYDI (server UTC deb o'qib kunni surmasin)", () => {
    const p = debtPayPayload("card", "2026-07-28", NOW)!;
    expect(String(p.paid_at)).toContain("+05:00");
    expect(String(p.paid_at)).not.toContain("Z");
  });
  it("KELAJAK sana → paid_at yuborilmaydi (klient ikkinchi himoya qatlami)", () => {
    expect(debtPayPayload("cash", "2026-12-31", NOW)).toEqual({ method: "cash" });
  });
  it("bo'sh sana → faqat method", () => {
    expect(debtPayPayload("cash", "", NOW)).toEqual({ method: "cash" });
  });
});

describe("canPayDebt — ikki marta to'lash to'sig'i", () => {
  it("to'lanmagan → to'lash mumkin", () => expect(canPayDebt({ is_paid: false })).toBe(true));
  it("to'langan → mumkin EMAS", () => expect(canPayDebt({ is_paid: true })).toBe(false));
});

describe("matnlar — serverникi bilan AYNAN bir xil", () => {
  it("mijozsiz qarz 400 matni", () => {
    expect(DEBT_CUSTOMER_REQUIRED).toBe("Qarzga sotishda mijozni tanlang yoki ism bilan telefon raqamini kiriting");
  });
  it("ikkinchi marta to'lash matni", () => {
    expect(DEBT_ALREADY_PAID).toBe("Bu qarz allaqachon to'langan");
  });
});

describe("debtQtyLabel — «N ta · M gul»", () => {
  it("gul soni bor", () => expect(debtQtyLabel(1, 25)).toBe("1 ta · 25 gul"));
  it("gul soni yo'q → faqat dona", () => expect(debtQtyLabel(2, null)).toBe("2 ta"));
  it("gul soni 0 → faqat dona", () => expect(debtQtyLabel(3, 0)).toBe("3 ta"));
});

describe("debtNum — server jamilarni NUMBER yoki STRING qaytaradi", () => {
  it("⚠️ jonli server bo'sh holatda 0.0 (number) berdi", () => expect(debtNum(0)).toBe(0));
  it("spec'dagi string decimal", () => expect(debtNum("450000.00")).toBe(450000));
  it("null/undefined → 0", () => {
    expect(debtNum(null)).toBe(0);
    expect(debtNum(undefined)).toBe(0);
  });
});
