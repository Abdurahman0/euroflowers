"use client";
import { fmt } from "@/lib/format";
import type { Supplier, SupplierBalanceStatus } from "@/lib/types";

/**
 * POSTAVSHIK BALANSI — server hisoblaydi (deploy 20.08.2026).
 *
 *     balance_total  = purchase_total + manual_debt_total − paid_total
 *     debt_total     = max(balance_total, 0)
 *     overpaid_total = max(−balance_total, 0)
 *
 * ⚠️ BIZ HISOBLAMAYMIZ. Ilgari bu ekranda «qarz tushunchasi yo'q» deb yozilgan
 * va `purchase − paid` ayirish TAQIQLANGAN edi. Endi qarz bor, lekin unga
 * QO'LDA KIRITILGAN qarz (`manual_debt_total`) ham qo'shiladi — o'zimiz
 * ayirsak o'sha qism tushib qolardi.
 *
 * ⚠️ Qiymatlar STRING ("112763500.00") bo'lib keladi → `Number()`.
 */
const n = (v: unknown): number => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};

const BADGE: Record<SupplierBalanceStatus, { label: string; hue: string }> = {
  debt: { label: "Qarz bor", hue: "var(--danger-ink)" },
  overpaid: { label: "Ortiqcha to'langan", hue: "var(--warning-ink, #8a6d1f)" },
  closed: { label: "Balans yopiq", hue: "var(--success-ink, #3d8a5f)" },
};

export function SupplierBalanceBadge({ status }: { status?: SupplierBalanceStatus | null }) {
  // ⚠️ Server holat bermasa — TAXMIN QILMAYMIZ, hech narsa chizmaymiz
  if (!status || !BADGE[status]) return null;
  const b = BADGE[status];
  return (
    <span
      className="shrink-0 rounded-full border px-2.5 py-0.5 text-[11px] font-bold"
      style={{
        background: `color-mix(in srgb, ${b.hue} 13%, transparent)`,
        borderColor: `color-mix(in srgb, ${b.hue} 30%, transparent)`,
        color: `color-mix(in srgb, ${b.hue} 78%, var(--text))`,
      }}
    >
      {b.label}
    </span>
  );
}

/** Balans bloki — xarid / to'langan / qarz. */
export default function SupplierBalance({ s, note }: { s: Supplier; note?: string }) {
  // maydonlar umuman kelmagan bo'lsa — blok chizilmaydi (nol ko'rsatib aldamaymiz)
  if (s.purchase_total == null && s.debt_total == null) return null;

  const purchase = n(s.purchase_total);
  const paid = n(s.paid_total);
  const manual = n(s.manual_debt_total);
  const debt = n(s.debt_total);
  const over = n(s.overpaid_total);
  const flowers = n(s.flower_purchase_total);
  const materials = n(s.material_purchase_total);

  const cells = [
    { k: "Sotib olingan", v: purchase, hue: "var(--text)", sub: `gul ${fmt(flowers)} · material ${fmt(materials)}` },
    { k: "To'langan", v: paid, hue: "var(--success-ink, #3d8a5f)", sub: manual > 0 ? `+ qo'lda qarz ${fmt(manual)}` : undefined },
    over > 0
      ? { k: "Ortiqcha to'langan", v: over, hue: "var(--warning-ink, #8a6d1f)", sub: "keyingi xaridga o'tadi" }
      : { k: "Qarz", v: debt, hue: debt > 0 ? "var(--danger-ink)" : "var(--muted)", sub: debt > 0 ? "to'lanishi kerak" : "qarz yo'q" },
  ];

  return (
    <div className="mt-3 rounded-[14px] border p-3" style={{ borderColor: "var(--border)", background: "var(--surface-2)" }}>
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-[1.5px]" style={{ color: "var(--muted)" }}>Balans</span>
        <SupplierBalanceBadge status={s.balance_status} />
        {note && <span className="ml-auto text-[11px]" style={{ color: "var(--muted)" }}>{note}</span>}
      </div>
      <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))" }}>
        {cells.map((c) => (
          <div key={c.k}>
            <div className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>{c.k}</div>
            <div className="text-[15px] font-extrabold tabular-nums" style={{ color: c.hue }}>{fmt(c.v)}</div>
            {c.sub && <div className="text-[10.5px]" style={{ color: "var(--muted)" }}>{c.sub}</div>}
          </div>
        ))}
      </div>
      {/* ⚠️ Formula OCHIQ yozilgan — operator raqam qayerdan chiqqanini so'ramasin */}
      <p className="mt-2 text-[10.5px] leading-snug" style={{ color: "var(--muted)" }}>
        Qarz = sotib olingan + qo&apos;lda qo&apos;shilgan qarz − to&apos;langan. Serverda hisoblanadi.
      </p>
    </div>
  );
}
