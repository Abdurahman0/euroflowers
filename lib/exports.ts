import { exportWorkbook, exportName, type SheetCol } from "./xlsx";
import { salarySourceLabel, KIND_LABEL, VOLUME_LABEL } from "./inventory";
import type { Accounting, FloristProfile, FloristSalaryEntry, SalarySource } from "./types";

/**
 * KLIENT eksportlari (SheetJS). Barchasi joriy davr (from/to) va filtrlarга
 * bo'ysunadi. Pul — RAQAM (so'm formati). Ma'lumotni sahifa oldindan oladi.
 */

const ARR_LABEL: Record<string, string> = { bouquet: "Buket", basket: "Savat", box: "Quti", catalog: "Katalog" };
const num = (v: unknown) => { const n = typeof v === "string" ? parseFloat(v) : Number(v); return Number.isFinite(n) ? n : 0; };
const floristName = (fp?: FloristProfile | null) => {
  const u = fp?.user_detail; return fp ? [u?.first_name, u?.last_name].filter(Boolean).join(" ") || u?.username || `#${fp.id}` : "";
};
/** salary entry ichidagi katalog tafsiloti (opaque object) — himoyalangan o'qish */
const cat = (e: FloristSalaryEntry) => (e.catalog_item_detail ?? {}) as Record<string, unknown>;

/* ===== 3a — FLORISTNING O'Z HISOBOTI ===== */
export async function exportFloristOwn(entries: FloristSalaryEntry[], name: string, from: string, to: string) {
  const cols: SheetCol[] = [
    { header: "Sana", key: "date", type: "date" },
    { header: "Manba", key: "source", type: "text" },
    { header: "Katalog nomi", key: "catalog", type: "text" },
    { header: "Turi", key: "arr", type: "text" },
    { header: "Hajm", key: "volume", type: "text" },
    { header: "Haq (so'm)", key: "fee", type: "money" },
  ];
  const rows = entries.map((e) => {
    const c = cat(e);
    return {
      date: e.work_date || (e.created_at ?? "").slice(0, 10),
      source: salarySourceLabel(e.source),
      catalog: (c.name_uz as string) || (c.name_ru as string) || "",
      arr: ARR_LABEL[(c.arrangement_type as string) ?? ""] ?? "",
      volume: VOLUME_LABEL[(c.volume as never)] ?? "",
      fee: num(e.amount),
    };
  });
  const total = rows.reduce((a, r) => a + num(r.fee), 0);
  await exportWorkbook(exportName(`Florist_Oylik_${name.replace(/\s+/g, "_")}`, from, to), [
    { name: "Oylik", cols, rows, totals: { date: "JAMI", source: "", catalog: "", arr: "", volume: "", fee: total } },
  ]);
}

/* ===== 3b — ADMIN: HAMMA FLORISTLAR ===== */
export async function exportAllFlorists(entries: FloristSalaryEntry[], florists: FloristProfile[], from: string, to: string) {
  // per-florist yig'indilar
  const byF = new Map<number, { name: string; standard: number; custom: number; total: number }>();
  florists.forEach((fp) => byF.set(fp.id, { name: floristName(fp), standard: 0, custom: 0, total: 0 }));
  entries.forEach((e) => {
    const id = e.florist ?? e.florist_detail?.id;
    if (id == null) return;
    const cur = byF.get(id) ?? { name: floristName(e.florist_detail) || `#${id}`, standard: 0, custom: 0, total: 0 };
    if (e.source === "catalog") cur.standard += 1;
    if (e.source === "custom_catalog") cur.custom += 1;
    cur.total += num(e.amount);
    byF.set(id, cur);
  });
  const summaryRows = Array.from(byF.values()).filter((r) => r.standard || r.custom || r.total).sort((a, b) => b.total - a.total);
  const sumCols: SheetCol[] = [
    { header: "Florist", key: "name", type: "text" },
    { header: "Standart (ta)", key: "standard", type: "int" },
    { header: "Maxsus (ta)", key: "custom", type: "int" },
    { header: "Jami oylik (so'm)", key: "total", type: "money" },
  ];
  const sumTotals = { name: "JAMI", standard: summaryRows.reduce((a, r) => a + r.standard, 0), custom: summaryRows.reduce((a, r) => a + r.custom, 0), total: summaryRows.reduce((a, r) => a + r.total, 0) };

  // bitta detal varaq — florist ustuni bilan (N varaqdan toza)
  const detCols: SheetCol[] = [
    { header: "Florist", key: "florist", type: "text" },
    { header: "Sana", key: "date", type: "date" },
    { header: "Manba", key: "source", type: "text" },
    { header: "Katalog", key: "catalog", type: "text" },
    { header: "Turi", key: "arr", type: "text" },
    { header: "Hajm", key: "volume", type: "text" },
    { header: "Haq (so'm)", key: "fee", type: "money" },
  ];
  const detRows = entries.map((e) => {
    const c = cat(e);
    return {
      florist: floristName(e.florist_detail) || `#${e.florist ?? ""}`,
      date: e.work_date || (e.created_at ?? "").slice(0, 10),
      source: salarySourceLabel(e.source),
      catalog: (c.name_uz as string) || (c.name_ru as string) || "",
      arr: ARR_LABEL[(c.arrangement_type as string) ?? ""] ?? "",
      volume: VOLUME_LABEL[(c.volume as never)] ?? "",
      fee: num(e.amount),
    };
  });
  await exportWorkbook(exportName("Floristlar_Oylik", from, to), [
    { name: "Xulosa", cols: sumCols, rows: summaryRows, totals: sumTotals },
    { name: "Batafsil", cols: detCols, rows: detRows },
  ]);
}

/* ===== 3c — ADMIN: FOYDA / TO'LOV TURI / KUNLAR BO'YICHA ===== */
export async function exportAccountingByDay(acc: Accounting, from: string, to: string) {
  // history'ni kunlar bo'yicha yig'amiz (backend kunlik breakdown bermaydi)
  type Day = { date: string; revenue: number; cash: number; card: number; terminal: number; cost: number; discount: number; profit: number };
  const days = new Map<string, Day>();
  acc.history.forEach((h) => {
    const d = (h.sold_at || "").slice(0, 10);
    const cur = days.get(d) ?? { date: d, revenue: 0, cash: 0, card: 0, terminal: 0, cost: 0, discount: 0, profit: 0 };
    const rev = num(h.sale_total);
    cur.revenue += rev;
    if (h.payment_type === "cash") cur.cash += rev;
    else if (h.payment_type === "card") cur.card += rev;
    // ⚠️ TERMINAL — kartaga QO'SHILMAYDI (backend 28.08.2026), alohida ustun
    else if (h.payment_type === "terminal") cur.terminal += rev;
    cur.cost += num(h.cost_total);
    cur.discount += num(h.discount_amount);
    cur.profit += num(h.net_profit);
    days.set(d, cur);
  });
  const rows = Array.from(days.values()).sort((a, b) => (a.date < b.date ? -1 : 1));
  const s = acc.summary;
  const totals = {
    date: "JAMI", revenue: num(s.total_sales), cash: num(s.cash_total), card: num(s.card_total),
    terminal: num(s.terminal_total ?? 0),
    cost: num(s.cost_total), discount: num(s.discount_total), profit: num(s.net_profit),
  };
  const cols: SheetCol[] = [
    { header: "Sana", key: "date", type: "date" },
    { header: "Savdo (so'm)", key: "revenue", type: "money" },
    { header: "Naqd (so'm)", key: "cash", type: "money" },
    { header: "Karta (so'm)", key: "card", type: "money" },
    { header: "Terminal (so'm)", key: "terminal", type: "money" },
    { header: "Tannarx (so'm)", key: "cost", type: "money" },
    { header: "Chegirma (so'm)", key: "discount", type: "money" },
    { header: "Sof foyda (so'm)", key: "profit", type: "money" },
  ];
  await exportWorkbook(exportName("Hisob-kitob", from, to), [{ name: "Kunlik", cols, rows, totals }]);
}

export type { SalarySource };
