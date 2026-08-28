"use client";
import { Wallet, TrendingUp, Info } from "lucide-react";
import { fmt } from "@/lib/format";
import type { AccountingSummary } from "@/lib/types";

/**
 * HISOB-KITOB TEPASIDAGI IKKI BLOK (spec §3, backend 76b3b72 · 20.08.2026).
 *
 *   1) MOLIYAVIY FOYDA — biznes foydasi: sotuv, uning naqd/karta ajratmasi, sof foyda.
 *   2) REAL KASSA / EGA — pul oqimi: tushum − postavshikka − floristga − rasxod.
 *
 * ⚠️ IKKI RAQAMNI ARALASHTIRMANG (spec §4 buni alohida ta'kidlaydi):
 *      net_profit      = sotuv − tannarx − chiqit
 *      owner_take_home = tushum − postavshikka to'langan − floristga berilgan − rasxod
 *    Shu sabab ular ikki ALOHIDA blokda va har birida formulasi ochiq yozilgan.
 *
 * ⚠️ `sales_cash_total`/`sales_card_total` — FAQAT TOVAR SAVDOSI ajratmasi (dastafkasiz).
 *    Sahifadagi «Naqd»/«Karta» KPI kartalari esa kassaga tushgan pul (dastafka ichida) —
 *    jonli farq 245 726 777 va 246 703 999. Shu bois bu yerda «sotuvdan» deb yozamiz.
 *
 * Maydon KELMASA qator CHIZILMAYDI (eski backend bilan ham buzilmaydi).
 */
const n = (v: unknown): number => (v == null || v === "" ? 0 : Number(v) || 0);
const has = (v: unknown): boolean => v != null && v !== "";

function Row({ label, value, sub, tone, strong }: { label: string; value: number; sub?: string; tone?: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className={`min-w-0 text-[12.5px] ${strong ? "font-bold" : "font-semibold"}`} style={{ color: strong ? "var(--text)" : "var(--text-2)" }}>
        {label}
        {sub && <span className="ml-1 text-[11px] font-medium" style={{ color: "var(--muted)" }}>· {sub}</span>}
      </span>
      <span className={`shrink-0 tabular-nums ${strong ? "text-[15px] font-extrabold" : "text-[13px] font-bold"}`} style={{ color: tone ?? "var(--text)" }}>
        {fmt(value)}
      </span>
    </div>
  );
}

function Block({ icon, title, note, children }: { icon: React.ReactNode; title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[16px] border p-4" style={{ borderColor: "var(--border)", background: "var(--surface-solid)" }}>
      <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-[1.2px]" style={{ color: "var(--text-2)" }}>
        <span style={{ color: "var(--primary)" }}>{icon}</span>
        {title}
      </div>
      <p className="mb-2 flex items-start gap-1 text-[11.5px] leading-snug" style={{ color: "var(--muted)" }}>
        <Info size={11} strokeWidth={2.2} className="mt-0.5 shrink-0" /> {note}
      </p>
      {children}
    </section>
  );
}

export default function AccountingOwnerBlocks({ s }: { s: AccountingSummary }) {
  // yangi maydonlarning BIRORTASI kelmasa — bloklar umuman chizilmaydi
  if (!has(s.owner_take_home) && !has(s.florist_accrued_total) && !has(s.sales_cash_total)) return null;

  const profitTone = n(s.net_profit) >= 0 ? "var(--success-ink, #3d8a5f)" : "var(--danger-ink)";
  const ownerTone = n(s.owner_take_home) >= 0 ? "var(--success-ink, #3d8a5f)" : "var(--danger-ink)";

  return (
    <div className="mb-3 grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
      <Block icon={<TrendingUp size={13} strokeWidth={2.4} />} title="Moliyaviy foyda" note="Sotuv − tannarx − chiqit. Bu BIZNES foydasi, qo'lga qoladigan pul emas.">
        <Row label="Umumiy sotuv" value={n(s.total_sales)} />
        {has(s.sales_cash_total) && <Row label="Sotuvdan naqd" value={n(s.sales_cash_total)} sub="dastafkasiz" />}
        {has(s.sales_card_total) && <Row label="Sotuvdan karta" value={n(s.sales_card_total)} sub="dastafkasiz" />}
        {has(s.sales_terminal_total) && <Row label="Sotuvdan terminal" value={n(s.sales_terminal_total)} sub="dastafkasiz" />}
        {n(s.sales_other_total) > 0 && <Row label="Sotuvdan boshqa" value={n(s.sales_other_total)} />}
        <div className="my-1 border-t" style={{ borderColor: "var(--border)" }} />
        <Row label="Sof foyda" value={n(s.net_profit)} tone={profitTone} strong />
        <Row label="Rasxodlardan keyingi foyda" value={n(s.net_profit_after_expenses)} sub={`rasxod ${fmt(n(s.expense_total))}`} />
      </Block>

      <Block icon={<Wallet size={13} strokeWidth={2.4} />} title="Real kassa / ega" note="Tushum − postavshiklarga to'langan − floristlarga berilgan − rasxodlar.">
        <Row label="Jami tushum" value={n(s.received_total)} sub="tovar + dastafka" />
        {has(s.supplier_paid_total) && <Row label="Postavshiklarga to'langan" value={-n(s.supplier_paid_total)} />}
        {has(s.florist_paid_total) && <Row label="Floristlarga berilgan" value={-n(s.florist_paid_total)} />}
        <Row label="Boshqa rasxodlar" value={-n(s.expense_total)} />
        <div className="my-1 border-t-2" style={{ borderColor: "var(--border-strong, var(--border))" }} />
        <Row label="Egaga qoladigan pul" value={n(s.owner_take_home)} tone={ownerTone} strong />
        {/* ⚠️ QARZLAR — kassadan CHIQMAGAN, lekin turibdi: alohida ko'rsatiladi */}
        {(has(s.supplier_debt_total) || has(s.florist_balance_total)) && (
          <div className="mt-2 border-t pt-2" style={{ borderColor: "var(--line2, var(--border))" }}>
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wide" style={{ color: "var(--muted)" }}>
              Hali to&apos;lanmagan
            </div>
            {has(s.supplier_debt_total) && <Row label="Postavshik qarzi" value={n(s.supplier_debt_total)} tone="var(--danger-ink)" />}
            {has(s.florist_accrued_total) && <Row label="Floristlarga hisoblangan" value={n(s.florist_accrued_total)} />}
            {has(s.florist_balance_total) && <Row label="Floristlarga qolgan qarz" value={n(s.florist_balance_total)} tone="var(--danger-ink)" />}
          </div>
        )}
      </Block>
    </div>
  );
}
