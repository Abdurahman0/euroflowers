"use client";
import { useState } from "react";
import type { BatchInventoryStat, FloristProductionStat } from "@/lib/types";

/**
 * Dashboard/Analytics YANGI bloklari — hammasi DEFENSIV: ma'lumot bo'lmasa
 * blok umuman ko'rsatilmaydi. Ranglar tema tokenlarida (waste — issiq amber).
 */

const money = (n: number | string | null | undefined): string => {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return Number.isFinite(v) ? String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, " ") + " so'm" : "—";
};
const num = (n: number | string | null | undefined): number => {
  const v = typeof n === "string" ? parseFloat(n) : n ?? 0;
  return Number.isFinite(v) ? v : 0;
};

/** NET PROFIT hero — katalog daromadi/tannarx/chegirma qo'llab-quvvatlash statlari bilan. */
export function NetProfitCard({ netProfit, revenue, cost, discount }: { netProfit?: number | string; revenue?: number | string; cost?: number | string; discount?: number | string }) {
  if (netProfit == null && revenue == null) return null;
  const mini = [
    { label: "Katalog daromadi", value: revenue },
    { label: "Tannarx", value: cost },
    { label: "Chegirma", value: discount },
  ].filter((m) => m.value != null);
  return (
    <section className="glass-lite p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Sof foyda</div>
      <div className="mt-1.5 whitespace-nowrap text-[26px] font-semibold tracking-tight" style={{ color: num(netProfit) < 0 ? "var(--danger-ink)" : "var(--acc)" }}>
        {money(netProfit)}
      </div>
      {mini.length > 0 && (
        <div className="mt-3 grid gap-2" style={{ gridTemplateColumns: `repeat(${mini.length},1fr)` }}>
          {mini.map((m) => (
            <div key={m.label} className="rounded-[12px] border px-3 py-2" style={{ borderColor: "var(--border)" }}>
              <div className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>{m.label}</div>
              <div className="mt-0.5 text-[13px] font-bold tabular-nums">{money(m.value)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * CHEGIRMA BLOKI — katalog chegirmada sotilganda backend history yozadi
 * (summary.discounted_catalog_*). Uch ko'rsatkich: nechta sotuv, nechta dona,
 * jami chegirma summasi. Ma'lumot yo'q bo'lsa blok chiqmaydi.
 */
export function DiscountStatsCard({
  count,
  quantity,
  amount,
}: {
  count?: number;
  quantity?: number;
  amount?: number | string;
}) {
  if (count == null && quantity == null && amount == null) return null;
  const tiles = [
    { label: "Skidkada sotuvlar", value: count != null ? `${count} ta` : "—" },
    { label: "Skidkada donalar", value: quantity != null ? `${quantity} dona` : "—" },
  ];
  return (
    <section className="glass-lite p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>Chegirmalar</div>
      <div className="mt-1.5 whitespace-nowrap text-[26px] font-semibold tracking-tight" style={{ color: num(amount) > 0 ? "var(--danger-ink)" : "var(--text)" }}>
        {money(amount)}
      </div>
      <p className="mt-0.5 text-[12px] font-medium" style={{ color: "var(--muted)" }}>jami chegirma qilingan summa</p>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-[12px] border px-3 py-2" style={{ borderColor: "var(--border)" }}>
            <div className="text-[11px] font-medium" style={{ color: "var(--muted)" }}>{t.label}</div>
            <div className="mt-0.5 text-[13px] font-bold tabular-nums">{t.value}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** Partiya sarf taqsimoti — standart/maxsus/chiqit/qolgan stacked bar. Chiqit bo'yicha saralanadi. */
export function BatchInventoryBars({ rows }: { rows?: BatchInventoryStat[] }) {
  const [hov, setHov] = useState<string | null>(null);
  if (!rows?.length) return null;
  const segs: { key: keyof BatchInventoryStat; label: string; hue: string }[] = [
    { key: "standard_catalog_stems", label: "Standart katalog", hue: "var(--primary)" },
    { key: "custom_catalog_stems", label: "Maxsus katalog", hue: "#6a6ac2" },
    { key: "waste_stems", label: "Chiqit", hue: "#b3873a" },
  ];
  const sorted = [...rows].sort((a, b) => num(b.waste_stems) - num(a.waste_stems));
  return (
    <section className="glass-lite p-5">
      <h2 className="text-[15px] font-bold tracking-tight">Partiya sarfi</h2>
      <p className="mt-0.5 text-[12px] font-medium" style={{ color: "var(--muted)" }}>chiqit ko&apos;p partiyalar birinchi</p>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-semibold" style={{ color: "var(--text-2)" }}>
        {segs.map((s) => (
          <span key={s.label} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.hue }} />{s.label}</span>
        ))}
      </div>
      <div className="mt-3 flex flex-col gap-2.5">
        {sorted.map((r, i) => {
          const total = Math.max(num(r.total_out_stems) || segs.reduce((t, s) => t + num(r[s.key]), 0), 1);
          const id = `${r.batch_id ?? r.batch_number ?? i}`;
          const flowerLabel = [r.flower, r.variant].filter(Boolean).join(" ") || r.variant;
          return (
            <div key={id} onMouseEnter={() => setHov(id)} onMouseLeave={() => setHov(null)}>
              <div className="mb-1 flex items-baseline justify-between gap-2 text-[12px]">
                <span className="min-w-0 truncate font-semibold" title={`${flowerLabel ?? ""} · ${r.supplier_name ?? ""}`}>
                  {flowerLabel ?? `Partiya ${r.batch_number ?? id}`}
                  {r.supplier_name && <span className="ml-1.5 font-medium" style={{ color: "var(--muted)" }}>· {r.supplier_name}</span>}
                </span>
                {hov === id && <span className="shrink-0 tabular-nums" style={{ color: "var(--muted)" }}>chiqit {num(r.waste_stems)} / {total} dona</span>}
              </div>
              <div className="flex h-[12px] overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                {segs.map((s) => {
                  const w = (num(r[s.key]) / total) * 100;
                  return w > 0 ? <div key={s.key} title={`${s.label}: ${num(r[s.key])} dona`} style={{ width: `${w}%`, background: s.hue }} /> : null;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** Florist ishlab chiqarish — standart vs maxsus + oylik. */
export function FloristProductionCards({ rows, salaryTotal }: { rows?: FloristProductionStat[]; salaryTotal?: number | string }) {
  if (!rows?.length) return null;
  const maxBouquets = Math.max(...rows.map((r) => num(r.standard_bouquets) + num(r.custom_bouquets) + num(r.standard_baskets) + num(r.custom_baskets)), 1);
  return (
    <section className="glass-lite p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold tracking-tight">Florist ishlab chiqarish</h2>
        {salaryTotal != null && <span className="text-[13px] font-bold" style={{ color: "var(--acc)" }}>Jami oylik: {money(salaryTotal)}</span>}
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))" }}>
        {rows.map((r, i) => {
          const bars = [
            { label: "Standart buket", v: num(r.standard_bouquets), hue: "var(--primary)" },
            { label: "Maxsus buket", v: num(r.custom_bouquets), hue: "#6a6ac2" },
            { label: "Standart savat", v: num(r.standard_baskets), hue: "#3d8a5f" },
            { label: "Maxsus savat", v: num(r.custom_baskets), hue: "#b3873a" },
          ].filter((x) => x.v > 0);
          return (
            <div key={r.florist_id ?? i} className="rounded-[14px] border p-3.5" style={{ borderColor: "var(--border)" }}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="min-w-0 truncate text-[13px] font-bold" title={r.name}>{r.name ?? `Florist #${r.florist_id ?? i}`}</span>
                {r.salary_total != null && <span className="shrink-0 text-[12px] font-bold" style={{ color: "var(--acc)" }}>{money(r.salary_total)}</span>}
              </div>
              <div className="mt-2 flex flex-col gap-1.5">
                {bars.length === 0 && <span className="text-[12px]" style={{ color: "var(--muted)" }}>Hozircha yo&apos;q</span>}
                {bars.map((bar) => (
                  <div key={bar.label} className="flex items-center gap-2">
                    <span className="w-[92px] shrink-0 truncate text-[11px]" style={{ color: "var(--text-2)" }}>{bar.label}</span>
                    <div className="h-[8px] flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                      <div className="h-full rounded-full" style={{ width: `${(bar.v / maxBouquets) * 100}%`, background: bar.hue }} />
                    </div>
                    <span className="w-6 shrink-0 text-right text-[11px] font-bold tabular-nums">{bar.v}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
