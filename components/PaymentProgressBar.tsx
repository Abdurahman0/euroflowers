"use client";
import { fmt } from "@/lib/format";
import { paymentProgress } from "@/lib/reservation";

/**
 * BRON to'lov progressi — sahifaning imzo elementi. Yupqa segmentli bar: to'langan (accent gradient) +
 * qolgan (muted). Ostida raqamlar: "200 000 to'langan · 300 000 qoldi". To'liq bo'lsa yashil + "To'liq to'langan".
 */
export default function PaymentProgressBar({
  paid,
  total,
  size = "md",
  compact = false,
}: {
  paid: string | number | null | undefined;
  total: string | number | null | undefined;
  size?: "sm" | "md";
  /** compact: raqamlarni bir qatorda, kichikroq (kartalar uchun) */
  compact?: boolean;
}) {
  const p = paymentProgress(paid, total);
  const h = size === "sm" ? "h-1.5" : "h-2.5";
  const done = p.full;
  return (
    <div className="flex flex-col gap-1">
      <div className={`w-full overflow-hidden rounded-full ${h}`} style={{ background: "var(--surface-2)" }} role="progressbar" aria-valuenow={p.pct} aria-valuemin={0} aria-valuemax={100}>
        <div
          className="h-full rounded-full transition-[width] duration-300"
          style={{
            width: `${Math.max(p.pct, p.paid > 0 ? 4 : 0)}%`,
            background: done ? "var(--success-ink, #3d8a5f)" : "linear-gradient(90deg, var(--acc), var(--primary))",
          }}
        />
      </div>
      <div className={`flex flex-wrap items-baseline gap-x-2 gap-y-0.5 ${compact ? "text-[11px]" : "text-[12px]"} font-semibold`}>
        {done ? (
          <span style={{ color: "var(--success-ink, #3d8a5f)" }}>To&apos;liq to&apos;langan · {fmt(p.total)}</span>
        ) : (
          <>
            <span style={{ color: "var(--acc)" }}>{fmt(p.paid)} to&apos;langan</span>
            <span style={{ color: "var(--muted)" }}>·</span>
            <span style={{ color: p.remaining > 0 ? "var(--text-2)" : "var(--muted)" }}>{fmt(p.remaining)} qoldi</span>
          </>
        )}
      </div>
    </div>
  );
}
