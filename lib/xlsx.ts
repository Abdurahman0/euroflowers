import * as XLSX from "xlsx";

/**
 * KLIENT tomonda .xlsx eksport — SheetJS. Pul maydonlari RAQAM sifatida
 * (matn emas) so'm formati bilan; sanalar to'g'ri formatlanadi. Barcha
 * eksportlar joriy davr/filtrlarga bo'ysunadi. Katta ma'lumotda UI qotmasligi
 * uchun yozishdan oldin bir marta "yield" qilinadi (bizning hajmlar kichik).
 */

export type ColType = "money" | "int" | "text" | "date";
export type SheetCol = { header: string; key: string; type?: ColType };
export type SheetDef = { name: string; cols: SheetCol[]; rows: Record<string, unknown>[]; totals?: Record<string, unknown> };

const MONEY_FMT = '#,##0 "so\'m"';

/** "EuroFlowers_<label>_<from>_<to>.xlsx" */
export const exportName = (label: string, from?: string, to?: string) =>
  `EuroFlowers_${label}${from && to ? `_${from}_${to}` : ""}.xlsx`;

export async function exportWorkbook(filename: string, sheets: SheetDef[]): Promise<void> {
  // UI'ni bloklamaslik uchun tugma loading holatini ko'rsatishga imkon beramiz
  await new Promise((r) => setTimeout(r, 0));
  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    const dataRows = sh.totals ? [...sh.rows, sh.totals] : sh.rows;
    const aoa: unknown[][] = [sh.cols.map((c) => c.header), ...dataRows.map((r) => sh.cols.map((c) => r[c.key] ?? ""))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const ref = ws["!ref"];
    if (ref) {
      const range = XLSX.utils.decode_range(ref);
      sh.cols.forEach((c, ci) => {
        if (c.type !== "money" && c.type !== "int") return;
        for (let ri = 1; ri <= range.e.r; ri++) {
          const cell = ws[XLSX.utils.encode_cell({ r: ri, c: ci })];
          if (cell && cell.v !== "" && cell.v != null && !Number.isNaN(Number(cell.v))) {
            cell.t = "n";
            cell.v = Number(cell.v);
            if (c.type === "money") cell.z = MONEY_FMT;
          }
        }
      });
    }
    ws["!cols"] = sh.cols.map((c) => ({ wch: Math.max(c.header.length + 2, c.type === "money" ? 15 : c.type === "date" ? 12 : 14) }));
    XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31));
  }
  XLSX.writeFile(wb, filename);
}
