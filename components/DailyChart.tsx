"use client";
import { useEffect, useRef, useState } from "react";

/**
 * Kunlik dinamika — chiziqli grafik (daily_stats: date/leads/conversations).
 * Kutubxonasiz, tema tokenlarida; ranglar CVD-validatsiyadan o'tgan
 * (--chart-1 pushti-rose, --chart-2 ko'k; light/dark alohida qadamlar).
 *   • 2px monotone-silliq chiziqlar, retsessiv to'r, matn — matn tokenlarida
 *   • hover: krosshair + 8px nuqta (yuza halqasi bilan) + tooltip
 *   • legend har doim ko'rinadi; ekran o'quvchilar uchun yashirin jadval
 */

export type DailyStat = { date: string; leads: number; conversations: number } & Record<string, number | string>;
export type ChartSeries = { key: string; label: string; varName: string };

const DEFAULT_SERIES: ChartSeries[] = [
  { key: "leads", label: "So'rovlar", varName: "var(--chart-1)" },
  { key: "conversations", label: "Suhbatlar", varName: "var(--chart-2)" },
];

const H = 240;
const PAD = { l: 36, r: 14, t: 14, b: 26 };
const MONTHS_S = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

const fmtD = (iso: string) => {
  const d = new Date(iso + "T00:00:00");
  return Number.isNaN(d.getTime()) ? iso : `${d.getDate()}-${MONTHS_S[d.getMonth()]}`;
};

/** chiroyli yuqori chegara: 1/2/5×10ⁿ */
const niceMax = (v: number) => {
  if (v <= 4) return Math.max(v, 4);
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const m of [1, 2, 5, 10]) if (v <= m * p) return m * p;
  return 10 * p;
};

/** monoton kubik interpolyatsiya — chiziq nuqtalardan oshib ketmaydi */
function monotonePath(xs: number[], ys: number[]): string {
  const n = xs.length;
  if (n === 0) return "";
  if (n === 1) return `M${xs[0]},${ys[0]}`;
  const dx: number[] = [], dy: number[] = [], m: number[] = [];
  for (let i = 0; i < n - 1; i++) { dx.push(xs[i + 1] - xs[i]); dy.push(ys[i + 1] - ys[i]); m.push(dy[i] / dx[i]); }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    t.push(m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2);
  }
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i] / m[i], b = t[i + 1] / m[i];
    const s = a * a + b * b;
    if (s > 9) { const f = 3 / Math.sqrt(s); t[i] = f * a * m[i]; t[i + 1] = f * b * m[i]; }
  }
  let d = `M${xs[0]},${ys[0]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += `C${xs[i] + h},${ys[i] + t[i] * h} ${xs[i + 1] - h},${ys[i + 1] - t[i + 1] * h} ${xs[i + 1]},${ys[i + 1]}`;
  }
  return d;
}

export default function DailyChart({ data, series = DEFAULT_SERIES }: { data: DailyStat[]; series?: ChartSeries[] }) {
  const SERIES = series;
  const num = (p: DailyStat, k: string) => Number(p[k]) || 0;
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

  if (!data.length) {
    return <p className="py-8 text-center text-[13px]" style={{ color: "var(--muted)" }}>Tanlangan davrda ma&apos;lumot yo&apos;q.</p>;
  }

  const yMax = niceMax(Math.max(...data.map((p) => Math.max(...SERIES.map((s) => num(p, s.key)))), 1));
  const iw = Math.max(w - PAD.l - PAD.r, 1);
  const ih = H - PAD.t - PAD.b;
  const X = (i: number) => PAD.l + (data.length === 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const Y = (v: number) => PAD.t + ih - (v / yMax) * ih;
  const xsArr = data.map((_, i) => X(i));

  // to'r: qadamlar soni yMax'ga qoldiqsiz bo'linadigan qilib tanlanadi —
  // yorliqlar doim butun son (13/25/38 kabi yaxlitlashlar bo'lmaydi)
  const steps = [4, 5, 3, 2].find((n) => n <= yMax && yMax % n === 0) ?? Math.min(4, yMax);
  const grid = Array.from({ length: steps + 1 }, (_, i) => (yMax / steps) * i);
  // x yorliqlari: HAR 2 KUN (juda uzun davrda 2 ning karralisiga kengayadi);
  // oxirgi kun yorlig'i yonidagisi bilan yopishib qolmasa qo'shiladi
  const every = data.length > 40 ? Math.ceil(data.length / 40) * 2 : 2;
  const base = data.map((_, i) => i).filter((i) => i % every === 0);
  const lastIdx = data.length - 1;
  const xTicks = base.includes(lastIdx) || lastIdx - base[base.length - 1] < 2 ? base : [...base, lastIdx];

  const onMove = (e: React.PointerEvent) => {
    const rect = wrapRef.current!.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0, bd = Infinity;
    xsArr.forEach((x, i) => { const d = Math.abs(x - px); if (d < bd) { bd = d; best = i; } });
    setHov(best);
  };

  const hovPt = hov != null ? data[hov] : null;
  // tooltip chetga chiqib ketmasin
  const tipLeft = hov != null ? Math.min(Math.max(xsArr[hov] - 74, 4), Math.max(w - 152, 4)) : 0;

  return (
    <div ref={wrapRef} className="relative w-full select-none">
      {/* legend — matn tokenlarida, rang faqat nuqtada */}
      <div className="mb-1.5 flex items-center justify-end gap-4">
        {SERIES.map((s) => (
          <span key={s.key} className="flex items-center gap-1.5 text-[12px] font-semibold" style={{ color: "var(--text-2)" }}>
            <span className="h-[9px] w-[9px] rounded-full" style={{ background: s.varName }} aria-hidden />
            {s.label}
          </span>
        ))}
      </div>

      {w > 0 && (
        <svg
          width={w}
          height={H}
          className="block cursor-crosshair"
          role="img"
          aria-label="Kunlik so'rovlar va suhbatlar grafigi"
          onPointerMove={onMove}
          onPointerLeave={() => setHov(null)}
        >
          {/* retsessiv to'r + y yorliqlari */}
          {grid.map((v, gi) => (
            <g key={gi}>
              <line x1={PAD.l} x2={w - PAD.r} y1={Y(v)} y2={Y(v)} stroke="var(--line2)" strokeWidth={1} strokeDasharray={v === 0 ? undefined : "3 5"} />
              <text x={PAD.l - 8} y={Y(v) + 3.5} textAnchor="end" fontSize={10.5} fontWeight={600} fill="var(--muted)">{v}</text>
            </g>
          ))}
          {/* x yorliqlari */}
          {xTicks.map((i) => (
            <text key={i} x={X(i)} y={H - 8} textAnchor="middle" fontSize={10.5} fontWeight={600} fill="var(--muted)">{fmtD(data[i].date)}</text>
          ))}
          {/* chiziqlar — 2px */}
          {SERIES.map((s) => (
            <path key={s.key} d={monotonePath(xsArr, data.map((p) => Y(num(p, s.key))))} fill="none" stroke={s.varName} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {/* krosshair + hover nuqtalari (yuza halqasi bilan) */}
          {hov != null && (
            <g>
              <line x1={xsArr[hov]} x2={xsArr[hov]} y1={PAD.t} y2={PAD.t + ih} stroke="var(--border-strong)" strokeWidth={1} />
              {SERIES.map((s) => (
                <circle key={s.key} cx={xsArr[hov]} cy={Y(num(data[hov], s.key))} r={4.5} fill={s.varName} stroke="var(--surface-solid)" strokeWidth={2} />
              ))}
            </g>
          )}
        </svg>
      )}

      {/* tooltip */}
      {hovPt && (
        <div
          className="pointer-events-none absolute z-10 w-[148px] rounded-[12px] border px-3 py-2 shadow-lg"
          style={{ left: tipLeft, top: 22, background: "var(--surface-solid)", borderColor: "var(--border)", boxShadow: "var(--shadow-md)" }}
        >
          <div className="text-[11px] font-bold" style={{ color: "var(--muted)" }}>{fmtD(hovPt.date)}</div>
          {SERIES.map((s) => (
            <div key={s.key} className="mt-0.5 flex items-center justify-between gap-2 text-[12px] font-semibold" style={{ color: "var(--text)" }}>
              <span className="flex items-center gap-1.5" style={{ color: "var(--text-2)" }}>
                <span className="h-[7px] w-[7px] rounded-full" style={{ background: s.varName }} aria-hidden />
                {s.label}
              </span>
              {num(hovPt, s.key)}
            </div>
          ))}
        </div>
      )}

      {/* ekran o'quvchilar uchun jadval ko'rinishi */}
      <table className="sr-only">
        <caption>Kunlik so&apos;rovlar va suhbatlar</caption>
        <thead>
          <tr><th>Sana</th>{SERIES.map((sr) => <th key={sr.key}>{sr.label}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.date}><td>{p.date}</td>{SERIES.map((sr) => <td key={sr.key}>{num(p, sr.key)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
