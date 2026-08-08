"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Leaf, Search } from "lucide-react";
import { api } from "@/lib/api";
import { isTestRecord } from "@/lib/finance";
import { freshness, formatStemsAndBunches, stems as fmtStems, bunches as fmtBunches } from "@/lib/inventory";
import EmptyState from "./EmptyState";
import { batchTitleNoHeight } from "@/lib/stockLabel";
import type { BatchInventoryStat, StockBatch } from "@/lib/types";

/**
 * PARTIYA SARFI — batch_inventory_stats'ni boyitib (stock-batches bilan batch_id
 * bo'yicha JOIN: received/remaining/received_at/stems_per_bunch) chiziqli sarf
 * paneli. Segmentlar: Standart → Maxsus → Chiqit → Qolgan (tema tokenlari).
 * Qolgan = received − (standart+maxsus+chiqit) — payload'da yo'q (API_AUDIT).
 */

const num = (n: number | string | null | undefined) => { const v = typeof n === "string" ? parseFloat(n) : n ?? 0; return Number.isFinite(v) ? v : 0; };
const grp = (n: number) => Math.round(n).toLocaleString("ru");
/** chiqit foizi jiddiyligi bo'yicha rang (<3% sage, 3-7% amber, >7% rose) */
const sevHue = (pct: number) => (pct < 3 ? "var(--success-ink, #3d8a5f)" : pct <= 7 ? "#b3873a" : "var(--danger-ink, #a04a4a)");

const SEG = [
  { key: "standard", label: "Standart", hue: "var(--acc)" },
  { key: "custom", label: "Maxsus", hue: "var(--info, #6a6ac2)" },
  { key: "waste", label: "Chiqit", hue: "var(--danger-ink, #a04a4a)" },
  { key: "qolgan", label: "Qolgan", hue: "var(--surface-2)" },
] as const;
type SegKey = (typeof SEG)[number]["key"];

type Row = {
  id: number; name: string; color?: string; batch_number?: string; supplier: string;
  received_at: string | null; spb?: number; received: number;
  standard: number; custom: number; waste: number; qolgan: number; total: number; wastePct: number; hasReceived: boolean;
};

type Sort = "waste" | "usage" | "fresh";
const SORTS: { key: Sort; label: string }[] = [
  { key: "waste", label: "Chiqit bo'yicha" },
  { key: "usage", label: "Sarf bo'yicha" },
  { key: "fresh", label: "Yangi partiyalar" },
];

/* ===== skeleton (iliq shimmer) ===== */
function SkeletonRows() {
  return (
    <div className="mt-3 flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="grid grid-cols-1 gap-2 sm:grid-cols-[40%_1fr] sm:items-center">
          <div className="flex flex-col gap-1.5">
            <div className="skeleton-warm h-3.5 w-2/3 rounded-full" />
            <div className="skeleton-warm h-2.5 w-1/2 rounded-full" />
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="skeleton-warm h-[11px] w-full rounded-full" />
            <div className="skeleton-warm h-2.5 w-3/4 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function BatchSarfiPanel({ rows: rawStats }: { rows?: BatchInventoryStat[] }) {
  // GUARD: batch_inventory_stats backend'da soft-delete qilingan ZZZ_TEST_ partiyalarни
  // ham qaytaradi (jonli tekshirilgan: 145 chiqit dona shulardan) — chiqarib tashlaymiz.
  const stats = rawStats?.filter((s) => !isTestRecord(s.batch_number));
  const [batchMap, setBatchMap] = useState<Map<number, StockBatch> | null>(null);
  const [sort, setSort] = useState<Sort>("waste");
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [ready, setReady] = useState(false);
  const [tip, setTip] = useState<{ row: Row; x: number; y: number } | null>(null);

  // stock-batches (is_active filtrsiz — nofaol partiyalar ham) — batch_id JOIN uchun.
  // Stat bo'sh bo'lsa so'rov yubormaymiz (ortiqcha yuk yo'q).
  useEffect(() => {
    if (!stats?.length) return;
    let alive = true;
    api.stockBatches().then((bs) => { if (alive) setBatchMap(new Map(bs.map((b) => [b.id, b]))); }).catch(() => alive && setBatchMap(new Map()));
    return () => { alive = false; };
  }, [stats]);
  // segment animatsiyasi uchun — mount'dan keyin haqiqiy kenglikka o'tadi
  useEffect(() => { const t = setTimeout(() => setReady(true), 30); return () => clearTimeout(t); }, []);

  const rows: Row[] = useMemo(() => {
    if (!stats || !batchMap) return [];
    return stats.map((s, i) => {
      const b = s.batch_id != null ? batchMap.get(s.batch_id) : undefined;
      const received = num(b?.received_stems);
      const standard = num(s.standard_catalog_stems);
      const custom = num(s.custom_catalog_stems);
      const waste = num(s.waste_stems);
      const out = standard + custom + waste;
      const hasReceived = received > 0;
      const qolgan = hasReceived ? Math.max(0, received - out) : 0;
      const total = hasReceived ? received : Math.max(out, 1);
      return {
        id: s.batch_id ?? i,
        // ⚠️ nom helper'dan — «general» qatorda `variant` bo'sh keladi
        name: batchTitleNoHeight(b ?? { flower: s.flower, variant: s.variant, color: s.color }, `Partiya ${s.batch_number ?? i}`),
        color: s.color, batch_number: s.batch_number,
        supplier: s.supplier_name || b?.supplier_detail?.name || "",
        received_at: b?.received_at ?? null, spb: b?.stems_per_bunch,
        received, standard, custom, waste, qolgan, total,
        wastePct: total > 0 ? (waste / total) * 100 : 0, hasReceived,
      };
    });
  }, [stats, batchMap]);

  const sorted = useMemo(() => {
    const arr = [...rows];
    if (sort === "waste") arr.sort((a, b) => b.wastePct - a.wastePct || b.waste - a.waste);
    else if (sort === "usage") arr.sort((a, b) => b.standard + b.custom - (a.standard + a.custom));
    else arr.sort((a, b) => freshness(a.received_at).days - freshness(b.received_at).days);
    return arr;
  }, [rows, sort]);

  const totals = useMemo(() => {
    const t = { received: 0, standard: 0, custom: 0, waste: 0, qolgan: 0 };
    rows.forEach((r) => { t.received += r.received; t.standard += r.standard; t.custom += r.custom; t.waste += r.waste; t.qolgan += r.qolgan; });
    const denom = t.received || t.standard + t.custom + t.waste || 1;
    return { ...t, denom, wastePct: (t.waste / denom) * 100 };
  }, [rows]);

  const q = query.trim().toLowerCase();
  const filtered = expanded && q
    ? sorted.filter((r) => [r.name, r.batch_number, r.supplier].some((x) => (x ?? "").toLowerCase().includes(q)))
    : sorted;
  const visible = expanded ? filtered : filtered.slice(0, 8);
  const spbAvg = useMemo(() => { const s = rows.filter((r) => r.spb).map((r) => r.spb!); return s.length ? s.reduce((a, b) => a + b, 0) / s.length : 0; }, [rows]);

  // empty (birinchi — stat bo'sh bo'lsa yuklamaymiz) / loading
  if (!stats?.length) return (
    <section className="glass-lite p-5">
      <h2 className="text-[15px] font-bold tracking-tight">Partiya sarfi</h2>
      <div className="py-6"><EmptyState title="Tanlangan davrda partiya sarfi yo'q" sub="Davrni kengaytiring — partiyalardan sarf bo'lganda shu yerda ko'rinadi." /></div>
    </section>
  );
  if (batchMap == null) return (
    <section className="glass-lite p-5"><h2 className="text-[15px] font-bold tracking-tight">Partiya sarfi</h2><SkeletonRows /></section>
  );

  const pct = (v: number, d: number) => (d > 0 ? Math.round((v / d) * 1000) / 10 : 0);

  const Chip = ({ label, main, sub, hue }: { label: string; main: string; sub?: string; hue?: string }) => (
    <div className="min-w-0 flex-1 rounded-[13px] border px-3 py-2" style={{ borderColor: "var(--border)" }}>
      <div className="truncate text-[10.5px] font-bold uppercase tracking-wider" style={{ color: "var(--muted)" }}>{label}</div>
      <div className="mt-0.5 truncate text-[15px] font-extrabold tabular-nums" style={{ color: hue ?? "var(--text)" }}>{main}</div>
      {sub && <div className="truncate text-[11px] font-medium" style={{ color: "var(--muted)" }}>{sub}</div>}
    </div>
  );

  return (
    <section className="glass-lite p-5">
      {/* sarlavha + sort */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold tracking-tight">Partiya sarfi</h2>
          <p className="mt-0.5 text-[12px] font-medium" style={{ color: "var(--muted)" }}>qaysi partiyadan qancha ketgan — chiqit diqqat markazida</p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SORTS.map((s) => (
            <button
              key={s.key}
              onClick={() => setSort(s.key)}
              aria-pressed={sort === s.key}
              className="rounded-full border-[1.5px] px-3 py-1 text-[11.5px] font-bold transition-colors"
              style={sort === s.key ? { background: "var(--primary)", borderColor: "var(--primary)", color: "#fff" } : { borderColor: "var(--border)", color: "var(--muted)" }}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* XULOSA — javob detaldan oldin */}
      <div className="mt-3 flex flex-wrap gap-2">
        <Chip label="Jami kelgan" main={formatStemsAndBunches(totals.received || totals.denom, spbAvg)} hue="var(--text)" />
        <Chip label="Standart" main={`${grp(totals.standard)} dona`} sub={`${pct(totals.standard, totals.denom)}%`} hue="var(--acc)" />
        <Chip label="Maxsus" main={`${grp(totals.custom)} dona`} sub={`${pct(totals.custom, totals.denom)}%`} hue="var(--info, #6a6ac2)" />
        <Chip label="Chiqit" main={`${grp(totals.waste)} dona`} sub={`${pct(totals.waste, totals.denom)}%`} hue={sevHue(totals.wastePct)} />
        <Chip label="Qolgan" main={formatStemsAndBunches(totals.qolgan, spbAvg)} hue="var(--muted)" />
      </div>

      {/* qidiruv (kengaytirilganda) */}
      {expanded && (
        <div className="mt-3 flex items-center gap-2 rounded-[12px] border px-3 py-1.5" style={{ borderColor: "var(--border)" }}>
          <Search size={14} strokeWidth={2} style={{ color: "var(--muted)" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Partiya / gul / yetkazib beruvchi…" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none" style={{ color: "var(--text)" }} />
        </div>
      )}

      {/* RO'YXAT — cheklangan balandlik + pastda soft mask */}
      <div
        className="mt-3 flex flex-col gap-3 overflow-y-auto overscroll-contain pr-1"
        data-lenis-prevent
        style={{ maxHeight: 520, maskImage: visible.length > 6 ? "linear-gradient(to bottom, #000 92%, transparent)" : undefined, WebkitMaskImage: visible.length > 6 ? "linear-gradient(to bottom, #000 92%, transparent)" : undefined }}
      >
        {visible.map((r, i) => {
          const fr = freshness(r.received_at);
          const segVals: Record<SegKey, number> = { standard: r.standard, custom: r.custom, waste: r.waste, qolgan: r.qolgan };
          return (
            <div key={r.id} className="grid grid-cols-1 gap-1.5 sm:grid-cols-[minmax(0,40%)_1fr] sm:items-center sm:gap-3">
              {/* LEFT — nom + meta */}
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold" title={r.name}>
                  {r.name}{r.color ? <span className="font-normal" style={{ color: "var(--muted)" }}> · {r.color}</span> : null}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px]">
                  {r.batch_number && <span className="rounded-full bg-tint px-1.5 py-px font-bold text-tintink">№{r.batch_number}</span>}
                  {r.supplier && <span className="max-w-[120px] truncate font-medium" style={{ color: "var(--muted)" }} title={r.supplier}>{r.supplier}</span>}
                  {r.received_at && <span className="rounded-full px-1.5 py-px font-bold" style={{ background: `color-mix(in srgb, ${fr.hue} 14%, transparent)`, color: fr.hue }}>{fr.label}</span>}
                </div>
              </div>

              {/* RIGHT — total, bar, micro-legend, waste badge */}
              <div className="min-w-0">
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  <span className="truncate text-[11px] font-medium" style={{ color: "var(--muted)" }} />
                  <span className="shrink-0 text-[11.5px] font-bold tabular-nums" style={{ color: "var(--text-2)" }}>{formatStemsAndBunches(r.total, r.spb)}</span>
                </div>
                {/* BAR — segmentli pill */}
                <div
                  className="flex h-[11px] items-stretch gap-[2px]"
                  role="img"
                  aria-label={`${r.name}: chiqit ${Math.round(r.wastePct)}%`}
                  tabIndex={0}
                  onMouseEnter={(e) => { const rc = (e.currentTarget as HTMLElement).getBoundingClientRect(); setTip({ row: r, x: rc.left + rc.width / 2, y: rc.top }); }}
                  onMouseLeave={() => setTip(null)}
                  onFocus={(e) => { const rc = e.currentTarget.getBoundingClientRect(); setTip({ row: r, x: rc.left + rc.width / 2, y: rc.top }); }}
                  onBlur={() => setTip(null)}
                >
                  {SEG.map((s) => {
                    const v = segVals[s.key];
                    if (v <= 0) return null;
                    return (
                      <div
                        key={s.key}
                        className="rounded-full"
                        style={{
                          flexGrow: ready ? v : 0,
                          flexBasis: 0,
                          minWidth: ready ? 3 : 0,
                          background: s.hue,
                          transition: "flex-grow .42s cubic-bezier(.22,1,.36,1)",
                          transitionDelay: `${Math.min(i, 5) * 30}ms`,
                        }}
                      />
                    );
                  })}
                </div>
                {/* micro-legend + waste badge */}
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px]">
                  {SEG.filter((s) => segVals[s.key] > 0).map((s) => (
                    <span key={s.key} className="flex items-center gap-1" style={{ color: "var(--muted)" }}>
                      <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: s.hue }} />
                      {s.label} <b className="tabular-nums" style={{ color: "var(--text-2)" }}>{grp(segVals[s.key])}</b>
                    </span>
                  ))}
                  <span className="ml-auto shrink-0">
                    {r.waste > 0 ? (
                      <span className="rounded-full px-2 py-0.5 text-[10.5px] font-extrabold tabular-nums" style={{ background: `color-mix(in srgb, ${sevHue(r.wastePct)} 15%, transparent)`, color: sevHue(r.wastePct) }}>
                        Chiqit {Math.round(r.wastePct * 10) / 10}%
                      </span>
                    ) : (
                      <span className="flex items-center gap-1 text-[10.5px] font-bold" style={{ color: "var(--success-ink, #3d8a5f)" }} title="Chiqit yo'q">
                        <Leaf size={12} strokeWidth={2.2} /> 0%
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
        {expanded && filtered.length === 0 && <p className="py-4 text-center text-[13px]" style={{ color: "var(--muted)" }}>Qidiruvga mos partiya yo&apos;q.</p>}
      </div>

      {/* Hammasini ko'rish */}
      {sorted.length > 8 && (
        <button
          onClick={() => { setExpanded((v) => !v); setQuery(""); }}
          className="mt-3 flex items-center gap-1.5 text-[12.5px] font-bold transition-colors"
          style={{ color: "var(--primary)" }}
        >
          <ChevronDown size={15} strokeWidth={2.2} style={{ transform: expanded ? "rotate(180deg)" : undefined, transition: "transform .2s" }} />
          {expanded ? "Yig'ish" : `Hammasini ko'rish (${sorted.length})`}
        </button>
      )}

      {/* TOOLTIP — portal (scroll konteynerida kesilmasin) */}
      {tip && typeof document !== "undefined" && createPortal(
        <div
          className="pointer-events-none fixed z-[97] w-[230px] -translate-x-1/2 -translate-y-full rounded-[13px] border p-3 text-[12px]"
          style={{ left: tip.x, top: tip.y - 8, background: "var(--surface-solid)", borderColor: "var(--border)", boxShadow: "var(--shadow-md, 0 12px 40px rgba(0,0,0,.2))" }}
        >
          <div className="truncate text-[12.5px] font-bold" title={tip.row.name}>{tip.row.name}</div>
          <div className="mt-0.5 flex flex-wrap gap-1.5 text-[10.5px]" style={{ color: "var(--muted)" }}>
            {tip.row.batch_number && <span>№{tip.row.batch_number}</span>}
            {tip.row.supplier && <span>· {tip.row.supplier}</span>}
          </div>
          <div className="mt-2 flex flex-col gap-1">
            {SEG.map((s) => {
              const v = ({ standard: tip.row.standard, custom: tip.row.custom, waste: tip.row.waste, qolgan: tip.row.qolgan } as Record<SegKey, number>)[s.key];
              return (
                <div key={s.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: s.hue }} />{s.label}
                  </span>
                  <span className="tabular-nums font-semibold" style={{ color: v > 0 ? "var(--text)" : "var(--muted)" }}>
                    {fmtStems(v)}{tip.row.spb ? ` · ${fmtBunches(v / tip.row.spb)}` : ""} · {pct(v, tip.row.total)}%
                  </span>
                </div>
              );
            })}
          </div>
        </div>,
        document.body
      )}
    </section>
  );
}
