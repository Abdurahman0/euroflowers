import type { FloristStockBalance } from "./types";

/** Kompozitsiya qatori (soddalashtirilgan) — validatsiya uchun faqat partiya + dona. */
export type CompStemRow = { stock_batch: number; stems: number };
type BalanceLite = Pick<FloristStockBalance, "batch" | "remaining_stems">;

/** SHU partiya bo'yicha florist balansi (dona). Tutmasa 0. */
export const balanceRemaining = (balances: BalanceLite[], batchId: number): number =>
  balances.find((b) => b.batch === batchId)?.remaining_stems ?? 0;

/** Florist bu partiyani umuman tutadimi (florist almashganda qayta-tekshirish uchun). */
export const batchHeldByFlorist = (balances: Pick<FloristStockBalance, "batch">[], batchId: number): boolean =>
  balances.some((b) => b.batch === batchId);

/** SHU partiyaga tegishli BARCHA qatorlar yig'indisi — ikki qator bitta partiyani
    BIRGA oshirib yubormasligi uchun validatsiya yig'indi bo'yicha bo'ladi. */
export const stemsForBatch = (rows: CompStemRow[], batchId: number): number =>
  rows.reduce((s, r) => s + (r.stock_batch === batchId ? r.stems : 0), 0);

/** Qator (yig'indi bo'yicha) florist balansidan oshib ketdimi. Florist tutmaydigan
    partiya `over` emas — u ALOHIDA «invalid» holat (batchHeldByFlorist=false). */
export const isBatchOverBalance = (rows: CompStemRow[], balances: BalanceLite[], batchId: number): boolean =>
  batchHeldByFlorist(balances, batchId) && stemsForBatch(rows, batchId) > balanceRemaining(balances, batchId);
