"use client";
import { gaugeOf, stems, formatStemsAndBunches } from "@/lib/inventory";
import type { StockBatch } from "@/lib/types";

/**
 * STEM GAUGE — partiya kartasining bosh elementi.
 * Ingichka yumaloq segmentlar qatori remaining/received nisbatini ko'rsatadi;
 * kam (<20%) — amber, tugagan — kulrang. Ranglar tema tokenlarida.
 */
export default function StemGauge({
  batch,
  segments = 24,
  compact = false,
}: {
  batch: Pick<StockBatch, "remaining_stems" | "received_stems" | "stems_per_bunch">;
  segments?: number;
  compact?: boolean;
}) {
  const g = gaugeOf(batch);
  const filled = Math.round(g.pct * segments);
  const pctText = Math.round(g.pct * 100);
  const spb = batch.stems_per_bunch;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate text-[12px] font-bold tabular-nums" style={{ color: g.tone === "empty" ? "var(--muted)" : "var(--text)" }}>
          {formatStemsAndBunches(batch.remaining_stems, spb)} <span className="font-medium" style={{ color: "var(--muted)" }}>/ {stems(batch.received_stems)}</span>
        </span>
        <span className="shrink-0 text-[12px] font-bold tabular-nums" style={{ color: g.hue }}>{pctText}%</span>
      </div>
      <div className={`flex ${compact ? "gap-[1.5px]" : "gap-[2px]"}`} role="img" aria-label={`Qoldiq: ${pctText}%`}>
        {Array.from({ length: segments }, (_, i) => (
          <span
            key={i}
            className="h-[10px] flex-1 rounded-full transition-colors duration-300"
            style={{ background: i < filled ? g.hue : "var(--surface-2)", minWidth: 2 }}
          />
        ))}
      </div>
    </div>
  );
}
