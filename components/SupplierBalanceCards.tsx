"use client";
import Link from "next/link";
import { Truck, Wallet, HandCoins, AlertTriangle } from "lucide-react";
import { fmt } from "@/lib/format";
import type { Dashboard } from "@/lib/types";

/**
 * POSTAVSHIK BALANSI — dashboard widgetlari (deploy 20.08.2026).
 *
 * ⚠️ HAMMA SON SERVERDAN. Biz `purchase − paid` ni O'ZIMIZ hisoblamaymiz:
 * balansda qo'lda kiritilgan qarz (`supplier_manual_debt_total`) ham bor va
 * uni unutsak raqam jimgina kam chiqardi.
 *
 * ⚠️ TUR: dashboard bu qiymatlarni SON qilib beradi (296982015.0), postavshik
 * ro'yxati esa SATR ("112763500.00"). Shu bois hamma joyda `Number()`.
 */
const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

export default function SupplierBalanceCards({ d }: { d: Dashboard }) {
  const purchase = n(d.supplier_purchase_total);
  const paid = n(d.supplier_paid_total);
  const manual = n(d.supplier_manual_debt_total);
  const debt = n(d.supplier_debt_total);
  const over = n(d.supplier_overpaid_total);
  const debtors = n(d.supplier_debtors_count);
  const flowers = n(d.supplier_flower_purchase_total);
  const materials = n(d.supplier_material_purchase_total);

  // ⚠️ Maydonlar umuman kelmagan bo'lsa (eski backend) — bo'lim CHIZILMAYDI,
  // nol to'la panel ko'rsatib «qarz yo'q» degan yolg'on taassurot bermaymiz.
  if (d.supplier_purchase_total == null && d.supplier_debt_total == null) return null;

  const cards = [
    {
      key: "purchase", label: "Postavshikdan olingan", value: purchase, hue: "var(--text)",
      sub: `gul ${fmt(flowers)} · material ${fmt(materials)}`,
      icon: Truck,
    },
    {
      key: "paid", label: "To'langan", value: paid, hue: "var(--success-ink, #3d8a5f)",
      sub: manual > 0 ? `qo'lda qo'shilgan qarz ${fmt(manual)}` : "qo'lda qarz yo'q",
      icon: Wallet,
    },
    {
      key: "debt", label: "Qarz", value: debt, hue: debt > 0 ? "var(--danger-ink)" : "var(--muted)",
      sub: debtors > 0 ? `${debtors} ta postavshikda` : "qarzdor yo'q",
      icon: HandCoins,
    },
  ];

  return (
    <section className="mt-6" aria-label="Postavshik balansi">
      <h3 className="mb-3 flex items-center gap-2 text-[13px] font-bold uppercase tracking-[1.5px]" style={{ color: "var(--text-2)" }}>
        <Truck size={15} strokeWidth={2.2} /> Postavshik balansi
        <span className="text-[11px] font-semibold normal-case tracking-normal" style={{ color: "var(--muted)" }}>· tanlangan davr</span>
      </h3>

      <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))" }}>
        {cards.map((c) => (
          <Link key={c.key} href="/suppliers" className="glass-lite card-hover block p-4" style={{ borderLeft: `3px solid ${c.hue}` }}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              <c.icon size={12} strokeWidth={2.2} /> {c.label}
            </div>
            <div className="mt-1.5 whitespace-nowrap text-[21px] font-semibold tracking-tight tabular-nums" style={{ color: c.hue }}>
              {fmt(c.value)}
            </div>
            <div className="mt-1 text-[12.5px] font-medium" style={{ color: "var(--text-2)" }}>{c.sub}</div>
          </Link>
        ))}

        {/* ⚠️ ORTIQCHA TO'LOV — faqat bo'lganda. Doim chizilsa «0 so'm» shovqin bo'lardi. */}
        {over > 0 && (
          <Link href="/suppliers" className="glass-lite card-hover block p-4" style={{ borderLeft: "3px solid var(--warning-ink, #8a6d1f)" }}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
              <AlertTriangle size={12} strokeWidth={2.2} /> Ortiqcha to&apos;langan
            </div>
            <div className="mt-1.5 whitespace-nowrap text-[21px] font-semibold tracking-tight tabular-nums" style={{ color: "var(--warning-ink, #8a6d1f)" }}>
              {fmt(over)}
            </div>
            <div className="mt-1 text-[12.5px] font-medium" style={{ color: "var(--text-2)" }}>kelishib, keyingi xaridga o&apos;tkazing</div>
          </Link>
        )}
      </div>
    </section>
  );
}
