"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Analitika grafik primitivlari — kutubxonasiz, tema tokenlarida.
 *   • HBars — gorizontal barlar (bitta o'lchov = bitta rang; identifikatsiya
 *     kerak bo'lsa qatorga o'z rangi beriladi), qiymat yorlig'i har doim matn
 *     tokenida, hover'da butun qator ajratiladi
 *   • RevenueBars — kunlik daromad ustunlari (yagona rang, 4px yumaloq uchlar
 *     baza chizig'iga langar, ustunlar orasida 2px yuza oralig'i), tooltip
 */

const MONTHS_S = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];
const fmtD = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? iso : `${d.getDate()}-${MONTHS_S[d.getMonth()]}`;
};
const fmtMoney = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");

export type HBarRow = { label: string; value: number; sub?: string; color?: string };

/** Gorizontal barlar — "eng ko'p sotilgan gullar" kabi reytinglar uchun. */
export function HBars({ rows, unit = "", color = "var(--chart-1)", format }: { rows: HBarRow[]; unit?: string; color?: string; format?: (v: number) => string }) {
  if (!rows.length) return <p className="py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>Ma&apos;lumot yo&apos;q.</p>;
  const max = Math.max(...rows.map((r) => r.value), 1);
  const fv = format ?? ((v: number) => String(v));
  return (
    <div className="flex flex-col gap-2.5" role="list">
      {rows.map((r, i) => (
        <div key={i} role="listitem" className="group">
          <div className="mb-1 flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-[13px] font-semibold" title={r.label}>
              {r.label}
              {r.sub && <span className="ml-1.5 font-medium" style={{ color: "var(--muted)" }}>{r.sub}</span>}
            </span>
            <span className="shrink-0 text-[13px] font-bold tabular-nums" style={{ color: "var(--text)" }}>
              {fv(r.value)}{unit && <span className="ml-1 font-medium" style={{ color: "var(--muted)" }}>{unit}</span>}
            </span>
          </div>
          <div className="h-[8px] overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
            <div
              className="h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:opacity-85"
              style={{ width: `${(r.value / max) * 100}%`, background: r.color ?? color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Kunlik daromad — ustunli grafik (yagona rang; 4px yumaloq uch, 2px oraliq). */
export function RevenueBars({ data }: { data: { date: string; revenue: string | number }[] }) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hov, setHov] = useState<number | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((es) => setW(Math.round(es[0].contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (!data.length) return <p className="py-6 text-center text-[13px]" style={{ color: "var(--muted)" }}>Ma&apos;lumot yo&apos;q.</p>;

  const H = 190;
  const PAD = { l: 8, r: 8, t: 12, b: 24 };
  const vals = data.map((d) => +d.revenue || 0);
  const max = Math.max(...vals, 1);
  const iw = Math.max(w - PAD.l - PAD.r, 1);
  const ih = H - PAD.t - PAD.b;
  const bw = Math.max((iw - (data.length - 1) * 2) / data.length, 2); // 2px yuza oralig'i
  const X = (i: number) => PAD.l + i * (bw + 2);
  const hgt = (v: number) => (v / max) * ih;

  const every = data.length > 40 ? Math.ceil(data.length / 40) * 2 : 2;
  const ticks = data.map((_, i) => i).filter((i) => i % every === 0);
  const tipLeft = hov != null ? Math.min(Math.max(X(hov) + bw / 2 - 74, 4), Math.max(w - 152, 4)) : 0;

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      {w > 0 && (
        <svg
          width={w}
          height={H}
          className="block cursor-crosshair"
          role="img"
          aria-label="Kunlik daromad grafigi"
          onPointerMove={(e) => {
            const rect = wrapRef.current!.getBoundingClientRect();
            const px = e.clientX - rect.left - PAD.l;
            setHov(Math.min(Math.max(Math.round(px / (bw + 2)), 0), data.length - 1));
          }}
          onPointerLeave={() => setHov(null)}
        >
          <line x1={PAD.l} x2={w - PAD.r} y1={PAD.t + ih} y2={PAD.t + ih} stroke="var(--line2)" strokeWidth={1} />
          {data.map((d, i) => {
            const h = Math.max(hgt(+d.revenue || 0), +d.revenue ? 3 : 0);
            return (
              <rect
                key={d.date}
                x={X(i)}
                y={PAD.t + ih - h}
                width={bw}
                height={h}
                rx={Math.min(4, bw / 2)}
                fill="var(--chart-1)"
                opacity={hov == null || hov === i ? 1 : 0.45}
                style={{ transition: "opacity 0.15s" }}
              />
            );
          })}
          {ticks.map((i) => (
            <text key={i} x={X(i) + bw / 2} y={H - 8} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="var(--muted)">
              {fmtD(data[i].date)}
            </text>
          ))}
        </svg>
      )}
      {hov != null && (
        <div
          className="pointer-events-none absolute z-10 w-[148px] rounded-[12px] border px-3 py-2 shadow-lg"
          style={{ left: tipLeft, top: 8, background: "var(--surface-solid)", borderColor: "var(--border)", boxShadow: "var(--shadow-md)" }}
        >
          <div className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>{fmtD(data[hov].date)}</div>
          <div className="mt-0.5 text-[13px] font-bold tabular-nums" style={{ color: "var(--text)" }}>
            {fmtMoney(+data[hov].revenue || 0)} <span className="font-medium" style={{ color: "var(--muted)" }}>so&apos;m</span>
          </div>
        </div>
      )}
      <table className="sr-only">
        <caption>Kunlik daromad</caption>
        <thead><tr><th>Sana</th><th>Daromad</th></tr></thead>
        <tbody>{data.map((d) => <tr key={d.date}><td>{d.date}</td><td>{String(d.revenue)}</td></tr>)}</tbody>
      </table>
    </div>
  );
}
