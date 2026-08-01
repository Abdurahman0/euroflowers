"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Download, TrendingUp, TrendingDown, PackagePlus, RotateCcw, Trash2, Info } from "lucide-react";
import { api, ApiError } from "@/lib/api";
import { useStore, usePerm } from "@/lib/store";
import { fmt, fmtDate, fmtTime, dateAfterParam, initials } from "@/lib/format";
import { STAFF_LABEL, formatStemsAndBunches } from "@/lib/inventory";
import DateChips from "@/components/DateChips";
import DailyChart from "@/components/DailyChart";
import FloristRateMatrix from "@/components/FloristRateMatrix";
import FloristStockIssueModal from "@/components/FloristStockIssueModal";
import FloristStockReturnDrawer from "@/components/FloristStockReturnDrawer";
import StockLine, { lineFromBatchDetail } from "@/components/StockLine";
import EmptyState from "@/components/EmptyState";
import FlowerLoader from "@/components/FlowerLoader";
import type { FloristProfile, FloristStats, FloristStockBalance, StockBatch } from "@/lib/types";

const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
/** joriy [from..to] (inklyuziv) uchun AVVALGI teng uzunlikdagi oyna (deltalar uchun). */
function prevPeriod(from: string, to: string): { from: string; to: string } {
  const a = new Date(from + "T00:00:00Z"); const b = new Date(to + "T00:00:00Z");
  const len = Math.round((+b - +a) / 86400000) + 1;
  const pTo = new Date(a); pTo.setUTCDate(pTo.getUTCDate() - 1);
  const pFrom = new Date(pTo); pFrom.setUTCDate(pFrom.getUTCDate() - (len - 1));
  return { from: pFrom.toISOString().slice(0, 10), to: pTo.toISOString().slice(0, 10) };
}
/** by_day → to'liq davr kun-ba-kun (bo'sh kunlar 0). Grafik masofani yolg'on ko'rsatmasin (BUG-4 fix). */
function gapFill(stats: FloristStats) {
  const byDate = new Map(stats.by_day.map((d) => [d.work_date, d]));
  const from = stats.period?.date_from || stats.by_day.map((d) => d.work_date).sort()[0];
  const to = stats.period?.date_to || stats.by_day.map((d) => d.work_date).sort().slice(-1)[0];
  if (!from || !to) return [] as { date: string; oylik: number; sotuvdan: number; sotildi: number }[];
  const out: { date: string; oylik: number; sotuvdan: number; sotildi: number }[] = [];
  const cur = new Date(from + "T00:00:00Z"); const end = new Date(to + "T00:00:00Z"); let g = 0;
  while (cur <= end && g++ < 400) {
    const k = cur.toISOString().slice(0, 10); const d = byDate.get(k);
    out.push({ date: k, oylik: d ? Math.round(+d.amount) : 0, sotuvdan: d ? Math.round(+d.sale_revenue) : 0, sotildi: d ? d.sold_quantity : 0 });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
}

const Tip = ({ text }: { text: string }) => <span title={text} className="ml-1 inline-block cursor-help align-middle text-[10px] font-bold" style={{ color: "var(--muted)" }}>ⓘ</span>;

/** bo'lim sarlavha «pill» + GlassCard */
function Section({ id, title, children, right }: { id: string; title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section id={id} className="glass !rounded-[18px] p-5">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2">
        <span className="rounded-full px-3 py-1 text-[12px] font-bold" style={{ background: "color-mix(in srgb, var(--primary) 22%, var(--surface-solid))", color: "var(--primary-strong, var(--primary))" }}>{title}</span>
        {right}
      </div>
      {children}
    </section>
  );
}

/** hero raqam — davrga qarab delta (oldingi teng davr bilan) + izoh */
function HeroStat({ label, value, caption, delta, tip, hero }: { label: string; value: string; caption?: string; delta?: number | null; tip?: string; hero?: boolean }) {
  return (
    <div className="relative overflow-hidden glass-lite !rounded-[18px] p-4" style={hero ? { background: "linear-gradient(150deg, color-mix(in srgb, var(--primary) 16%, var(--surface-solid)), var(--surface-solid))" } : undefined}>
      {hero && <div className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full" style={{ background: "var(--primary)", opacity: 0.16, filter: "blur(28px)" }} />}
      <div className="relative flex items-center gap-1 text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: "var(--muted)" }}>
        {label}{tip && <Tip text={tip} />}
      </div>
      <div className={`relative mt-1 font-extrabold tracking-tight ${hero ? "font-serif-lux text-[30px]" : "text-[22px]"}`} style={{ color: hero ? "var(--primary-strong, var(--primary))" : "var(--text)" }}>{value}</div>
      <div className="relative mt-1 flex items-center gap-2">
        {delta != null && delta !== 0 && (
          <span className="flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold" style={{ background: delta > 0 ? "color-mix(in srgb, var(--success-ink) 14%, transparent)" : "color-mix(in srgb, var(--danger-ink) 14%, transparent)", color: delta > 0 ? "var(--success-ink)" : "var(--danger-ink)" }}>
            {delta > 0 ? <TrendingUp size={11} strokeWidth={2.5} /> : <TrendingDown size={11} strokeWidth={2.5} />}{Math.abs(delta)}%
          </span>
        )}
        {delta === 0 && <span className="text-[11px] font-semibold" style={{ color: "var(--muted)" }}>o&apos;zgarishsiz</span>}
      </div>
      {caption && <div className="relative mt-1 text-[11.5px] leading-snug" style={{ color: "var(--text-2)" }}>{caption}</div>}
    </div>
  );
}

const pct = (cur: number, prev: number): number | null => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : (cur > 0 ? 100 : null));

export default function FloristDetailPage() {
  const params = useParams();
  const id = Number(params?.id);
  const { showToast, dateFilter, dateRange } = useStore();
  const { canControl } = usePerm();
  const canManage = canControl("inventory");

  const [florist, setFlorist] = useState<FloristProfile | null>(null);
  const [stats, setStats] = useState<FloristStats | null>(null);
  const [prev, setPrev] = useState<FloristStats | null>(null);
  const [balances, setBalances] = useState<FloristStockBalance[] | null>(null);
  const [batches, setBatches] = useState<StockBatch[]>([]);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dayMode, setDayMode] = useState<"oylik" | "sotuvdan">("oylik");
  const [issueOpen, setIssueOpen] = useState(false);
  const [returnTarget, setReturnTarget] = useState<{ balance: FloristStockBalance; kind: "return" | "waste" } | null>(null);

  const from = dateRange ? dateRange.from : dateAfterParam(dateFilter);
  const to = dateRange ? dateRange.to : ymd(new Date());

  const loadStats = useCallback(() => {
    if (!id) return;
    setErr("");
    api.floristStats(id, { from, to }).then(setStats).catch((e) => setErr(e instanceof Error ? e.message : "Yuklab bo'lmadi"));
    const pp = prevPeriod(from, to);
    api.floristStats(id, { from: pp.from, to: pp.to }).then(setPrev).catch(() => setPrev(null));
  }, [id, from, to]);

  const loadBalances = useCallback(() => {
    if (!id) return;
    api.floristStockBalances({ florist: id, only_available: "false", ordering: "batch" }).then(setBalances).catch(() => setBalances([]));
  }, [id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.florist(id).then(setFlorist).catch(() => setFlorist(null)).finally(() => setLoading(false));
    api.stockBatches({ is_active: true }).then((bs) => setBatches(bs.filter((b) => b.remaining_stems > 0))).catch(() => {});
  }, [id]);
  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { loadBalances(); }, [loadBalances]);

  const doExport = async () => {
    setExporting(true);
    try { await api.exportFlorist({ florist: id, date_from: from, date_to: to }); showToast("✓ Excel yuklab olindi"); }
    catch (e) { showToast(e instanceof ApiError ? e.message : "Eksport qilib bo'lmadi"); }
    finally { setExporting(false); }
  };

  const name = florist?.user_detail ? [florist.user_detail.first_name, florist.user_detail.last_name].filter(Boolean).join(" ") || florist.user_detail.username : (stats?.florist.name || `Florist #${id}`);
  const staffType = florist?.staff_type ?? stats?.florist.staff_type ?? "florist";
  const active = florist?.is_active ?? stats?.florist.is_active ?? true;
  const phone = florist?.phone || stats?.florist.phone || "";

  const daily = useMemo(() => (stats ? gapFill(stats) : []), [stats]);
  const heldTotal = useMemo(() => (balances ?? []).reduce((s, b) => s + b.remaining_stems, 0), [balances]);
  const heldValue = useMemo(() => (balances ?? []).reduce((s, b) => s + b.remaining_stems * (+(b.batch_detail?.cost_per_stem ?? 0) || 0), 0), [balances]);

  if (loading) return <FlowerLoader />;

  return (
    <div className="flex flex-col gap-4 pb-6">
      {/* ── HEADER ── */}
      <div className="flex flex-col gap-3">
        <Link href="/floristlar" className="flex w-fit items-center gap-1.5 text-[13px] font-semibold transition-colors hover:text-[color:var(--primary)]" style={{ color: "var(--muted)" }}>
          <ArrowLeft size={15} strokeWidth={2.2} /> Floristlar
        </Link>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0">
            <h1 className="font-serif-lux truncate text-[28px] font-extrabold leading-tight tracking-tight" title={name}>{name}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[12.5px]">
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: "var(--hover)", color: "var(--text-2)" }}>{STAFF_LABEL[staffType] ?? staffType}</span>
              <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold" style={{ background: active ? "color-mix(in srgb, var(--success-ink) 14%, transparent)" : "var(--surface-2)", color: active ? "var(--success-ink)" : "var(--muted)" }}>{active ? "Faol" : "Nofaol"}</span>
              {phone && <span className="tabular-nums" style={{ color: "var(--muted)" }}>{phone}</span>}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DateChips />
            <button onClick={doExport} disabled={exporting} className="flex items-center gap-1.5 rounded-[12px] border-[1.5px] px-3 py-1.5 text-[12.5px] font-bold transition-colors hover:bg-[var(--hover)] disabled:opacity-60" style={{ borderColor: "var(--border-strong)", color: "var(--text-2)" }}>
              <Download size={14} strokeWidth={2} /> {exporting ? "Yuklanmoqda…" : "Excel (6 varaq)"}
            </button>
          </div>
        </div>
      </div>

      {err && (
        <div className="glass !rounded-[16px] p-6 text-center">
          <p className="text-[13px] font-bold" style={{ color: "var(--danger-ink)" }}>{err}</p>
          <button onClick={loadStats} className="mt-3 rounded-full border px-4 py-1.5 text-[12.5px] font-bold" style={{ borderColor: "var(--border-strong)" }}>Qayta urinish</button>
        </div>
      )}

      {!stats && !err && <div className="grid gap-3 sm:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="glass-lite !rounded-[18px] h-[112px] animate-pulse" style={{ opacity: 0.6 }} />)}</div>}

      {stats && (() => {
        const s = stats.summary; const p = prev?.summary;
        return (
          <>
            {/* ── HERO STATS ── */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <HeroStat hero label="Jami ish haqi" value={`${fmt(s.salary_total)}`} delta={p ? pct(+s.salary_total, +p.salary_total) : null}
                caption="Katalog YARATILGANDA yoziladi (sotilganda emas)." tip="Har katalog qo'shilганда floristga tarif bo'yicha haq yoziladi — sotuvni kutmaydi." />
              <HeroStat label="Sotuv daromadi" value={`${fmt(s.sale_revenue)}`} delta={p ? pct(+s.sale_revenue, +p.sale_revenue) : null}
                caption="Uning mahsulotlari sotuvidan tushgan real summa (chegirmadan keyin)." tip="Ko'rsatilgan narx emas — haqiqiy sotilgan narx." />
              <HeroStat label="Mahsulot soni" value={String(s.catalog_count)} delta={p ? pct(s.catalog_count, p.catalog_count) : null}
                caption={`${s.bouquet_count} buket · ${s.basket_count} savat`} />
              <HeroStat label="Ishlagan kunlar" value={String(s.attendance_days)} delta={p ? pct(s.attendance_days, p.attendance_days) : null}
                caption="Keldi-ketdi bo'yicha ro'yxatga olingan kunlar." />
            </div>

            {/* a) ISHLAB CHIQARISH */}
            <Section id="prod" title="Ishlab chiqarish">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-3">
                  <MiniRow k="Buket / Savat" v={`${s.bouquet_count} / ${s.basket_count}`} />
                  <MiniRow k="Standart / Maxsus" v={`${s.standard_count} / ${s.custom_count}`} />
                  <MiniRow k="O'rtacha haq (1 mahsulotga)" v={fmt(s.avg_fee_per_item)} tip="Jami ish haqi ÷ mahsulot soni." />
                </div>
                <div>
                  <div className="mb-1.5 flex items-baseline justify-between text-[12.5px]">
                    <span className="font-semibold" style={{ color: "var(--text-2)" }}>Sotilgan / Qolgan</span>
                    <span className="tabular-nums" style={{ color: "var(--muted)" }}>{s.sold_quantity} / {s.unsold_quantity}{s.sold_quantity + s.unsold_quantity > 0 ? ` · ${Math.round((s.sold_quantity / (s.sold_quantity + s.unsold_quantity)) * 100)}% sotilgan` : ""}</span>
                  </div>
                  {s.sold_quantity + s.unsold_quantity > 0 ? (
                    <div className="flex h-5 w-full overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                      <div className="h-full" style={{ width: `${(s.sold_quantity / (s.sold_quantity + s.unsold_quantity)) * 100}%`, background: "var(--success-ink)" }} title={`Sotilgan: ${s.sold_quantity}`} />
                      <div className="h-full" style={{ width: `${(s.unsold_quantity / (s.sold_quantity + s.unsold_quantity)) * 100}%`, background: "var(--primary)" }} title={`Qolgan: ${s.unsold_quantity}`} />
                    </div>
                  ) : <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>Mahsulot yo&apos;q.</p>}
                  <div className="mt-2 flex items-center gap-4 text-[11px]" style={{ color: "var(--muted)" }}>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--success-ink)" }} /> Sotilgan</span>
                    <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--primary)" }} /> Sotuvda qolgan</span>
                  </div>
                </div>
              </div>
            </Section>

            {/* b) KUNLAR BO'YICHA */}
            <Section id="days" title="Kunlar bo'yicha" right={
              <div className="flex items-center gap-1 rounded-full border p-1" style={{ borderColor: "var(--border)" }}>
                {([["oylik", "Ish haqi"], ["sotuvdan", "Sotuvdan tushgan"]] as const).map(([k, l]) => (
                  <button key={k} onClick={() => setDayMode(k)} aria-pressed={dayMode === k} className="rounded-full px-3 py-1 text-[12px] font-bold transition-colors" style={dayMode === k ? { background: "var(--primary)", color: "#fff" } : { color: "var(--muted)" }}>{l}</button>
                ))}
              </div>
            }>
              {daily.some((d) => d.oylik || d.sotuvdan || d.sotildi) ? (
                <DailyChart data={daily} series={dayMode === "oylik"
                  ? [{ key: "oylik", label: "Ish haqi (so'm)", varName: "var(--chart-1)" }, { key: "sotildi", label: "Sotilgan (dona)", varName: "var(--chart-2)" }]
                  : [{ key: "sotuvdan", label: "Sotuvdan (so'm)", varName: "var(--chart-3)" }, { key: "sotildi", label: "Sotilgan (dona)", varName: "var(--chart-2)" }]} />
              ) : <EmptyState title="Bu davrda faoliyat yo'q" sub="Tanlangan oralig'da ish haqi ham, sotuv ham yozilmagan." />}
            </Section>

            {/* c) HAJM VA TUR */}
            <Section id="mix" title="Hajm va tur bo'yicha">
              <div className="grid items-start gap-4 lg:grid-cols-2">
                <div>
                  <div className="mb-1.5 text-[12px] font-bold" style={{ color: "var(--text-2)" }}>Turi bo&apos;yicha</div>
                  <MixTable rows={stats.by_arrangement.map((a) => ({ label: a.arrangement_label, sub: "", count: a.count, sold: a.sold_quantity, amount: a.amount }))} />
                </div>
                <div>
                  <div className="mb-1.5 text-[12px] font-bold" style={{ color: "var(--text-2)" }}>Hajm bo&apos;yicha</div>
                  <MixTable rows={stats.by_volume.map((v) => ({ label: v.arrangement_label, sub: v.volume, count: v.count, sold: v.sold_quantity, amount: v.amount }))} />
                </div>
              </div>
            </Section>

            {/* d) MANBA BO'YICHA */}
            <Section id="source" title="Manba bo'yicha">
              {(() => {
                const rows = stats.by_source.filter((x) => x.count > 0 || +x.amount > 0);
                const max = Math.max(...rows.map((x) => +x.amount), 1);
                return rows.length === 0 ? <EmptyState title="Ma'lumot yo'q" /> : (
                  <div className="flex flex-col gap-2.5">
                    {rows.map((x) => (
                      <div key={x.source} className="flex items-center gap-3">
                        <span className="w-[110px] shrink-0 truncate text-[13px] font-semibold" title={x.source_label}>{x.source_label}</span>
                        <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                          <div className="h-full rounded-full" style={{ width: `${(+x.amount / max) * 100}%`, background: "linear-gradient(90deg, var(--acc), var(--accL, var(--primary)))" }} />
                        </div>
                        <span className="shrink-0 text-right text-[12.5px] font-bold tabular-nums">{fmt(x.amount)} <span className="font-medium" style={{ color: "var(--muted)" }}>· {x.count}</span></span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </Section>

            {/* e) HAJM TARIFLARI */}
            <Section id="rates" title="Hajm tariflari">
              {florist ? <FloristRateMatrix florist={florist} /> : <p className="text-[13px]" style={{ color: "var(--muted)" }}>Florist ma&apos;lumoti yuklanmadi.</p>}
            </Section>

            {/* f) ISH HAQI TARIXI */}
            <Section id="salary" title="Ish haqi tarixi">
              {stats.salary_entries.length === 0 ? <EmptyState title="Yozuv yo'q" sub="Bu davrda ish haqi yozuvi yo'q." /> : (
                <div className="overflow-x-auto thin-scroll">
                  <table className="w-full min-w-[760px] border-collapse text-[12.5px]">
                    <thead><tr className="text-left" style={{ color: "var(--muted)" }}>
                      <th className="px-1.5 py-1.5 font-semibold">Sana</th><th className="px-1.5 py-1.5 font-semibold">Manba</th><th className="px-1.5 py-1.5 font-semibold">Mahsulot</th>
                      <th className="px-1.5 py-1.5 text-right font-semibold">Narxi</th><th className="px-1.5 py-1.5 text-right font-semibold">Sotildi</th><th className="px-1.5 py-1.5 text-right font-semibold">Sotuvdan</th><th className="px-1.5 py-1.5 text-right font-semibold">Haq</th>
                    </tr></thead>
                    <tbody>
                      {stats.salary_entries.map((e) => (
                        <tr key={e.id} className="border-t" style={{ borderColor: "var(--line2)" }}>
                          <td className="px-1.5 py-1.5 tabular-nums whitespace-nowrap">{fmtDate(e.work_date)}</td>
                          <td className="px-1.5 py-1.5"><span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--hover)", color: "var(--text-2)" }}>{e.source_label}</span></td>
                          <td className="px-1.5 py-1.5">
                            {e.catalog_item_id ? (
                              <span className="block max-w-[220px] truncate" title={e.catalog_name || ""}>{e.catalog_name}<span className="block text-[11px]" style={{ color: "var(--muted)" }}>{[e.arrangement_label, e.volume].filter(Boolean).join(" · ")}</span></span>
                            ) : <span style={{ color: "var(--muted)" }}>{e.note || "— (kunlik/qo'lda)"}</span>}
                          </td>
                          <td className="px-1.5 py-1.5 text-right tabular-nums" style={{ color: "var(--muted)" }}>{e.listed_price ? fmt(e.listed_price) : "—"}</td>
                          <td className="px-1.5 py-1.5 text-right">{e.catalog_item_id ? (e.is_sold ? <span className="rounded-full px-2 py-0.5 text-[11px] font-bold whitespace-nowrap" style={{ background: "color-mix(in srgb, var(--success-ink) 14%, transparent)", color: "var(--success-ink)" }}>{e.sold_quantity} ta{e.last_sold_at ? ` · ${fmtDate(e.last_sold_at)}` : ""}</span> : <span style={{ color: "var(--muted)" }}>sotilmagan</span>) : <span style={{ color: "var(--muted)" }}>—</span>}</td>
                          <td className="px-1.5 py-1.5 text-right tabular-nums">{+e.sale_revenue > 0 ? fmt(e.sale_revenue) : "—"}</td>
                          <td className="px-1.5 py-1.5 text-right font-bold tabular-nums">{fmt(e.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Section>

            {/* g) KELDI-KETDI */}
            <Section id="attend" title="Keldi-ketdi">
              {stats.attendance.length === 0 ? <EmptyState title="Davomat yozuvi yo'q" sub="Bu davrda keldi-ketdi qayd etilmagan." /> : (
                <div className="flex flex-col gap-1.5">
                  {stats.attendance.map((a) => (
                    <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-[11px] px-3 py-2 text-[12.5px]" style={{ background: "var(--surface-2)" }}>
                      <span className="font-semibold tabular-nums">{fmtDate(a.work_date)}</span>
                      <span className="flex items-center gap-3">
                        <span style={{ color: "var(--success-ink)" }}>Keldi {a.check_in_at ? fmtTime(a.check_in_at) : "—"}</span>
                        <span style={{ color: "var(--danger-ink)" }}>Ketdi {a.check_out_at ? fmtTime(a.check_out_at) : "—"}</span>
                        <span className="rounded-full px-2 py-0.5 text-[10.5px] font-bold" style={{ background: "var(--hover)", color: "var(--text-2)" }}>{a.source_label}</span>
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            {/* h) QO'LIDAGI GULLAR */}
            <Section id="held" title="Qo'lidagi gullar" right={canManage ? (
              <button onClick={() => setIssueOpen(true)} className="flex items-center gap-1.5 rounded-[11px] px-3 py-1.5 text-[12px] font-bold text-white transition-opacity hover:opacity-90" style={{ background: "var(--primary)" }}>
                <PackagePlus size={14} strokeWidth={2.2} /> Skladdan chiqarish
              </button>
            ) : undefined}>
              {balances === null ? <p className="py-3 text-center text-[12.5px]" style={{ color: "var(--muted)" }}>Yuklanmoqda…</p>
                : balances.filter((b) => b.remaining_stems > 0).length === 0 ? <EmptyState title="Hozircha gul yo'q" sub="Bu floristda hozir gul qoldig'i yo'q — «Skladdan chiqarish» orqali chiqaring." />
                : (
                  <>
                    <div className="mb-3 flex flex-wrap gap-2 text-[11.5px] font-bold">
                      <span className="rounded-full bg-tint px-2.5 py-0.5">Jami: {formatStemsAndBunches(heldTotal, undefined)}</span>
                      <span className="rounded-full bg-tint px-2.5 py-0.5">Tannarx qiymati: {fmt(heldValue)}</span>
                    </div>
                    <div className="flex flex-col gap-2">
                      {balances.filter((b) => b.remaining_stems > 0).map((b) => {
                        const spb = b.batch_detail?.stems_per_bunch || 1;
                        return (
                          <div key={b.id} className="flex flex-wrap items-center gap-3 rounded-[13px] border p-2.5" style={{ borderColor: "var(--border)" }}>
                            <div className="min-w-[200px] flex-1"><StockLine data={lineFromBatchDetail(b.batch_detail)} right={<div className="text-right"><div className="text-[13px] font-bold tabular-nums">{formatStemsAndBunches(b.remaining_stems, spb)}</div><div className="text-[11px]" style={{ color: "var(--muted)" }}>{fmt(b.remaining_stems * (+(b.batch_detail?.cost_per_stem ?? 0) || 0))}</div></div>} /></div>
                            {canManage && (
                              <div className="flex shrink-0 items-center gap-2">
                                <button onClick={() => setReturnTarget({ balance: b, kind: "return" })} className="flex items-center gap-1.5 rounded-[11px] border px-2.5 py-1.5 text-[12px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", color: "var(--success-ink)" }}><RotateCcw size={13} strokeWidth={2.2} /> Qaytarish</button>
                                <button onClick={() => setReturnTarget({ balance: b, kind: "waste" })} className="flex items-center gap-1.5 rounded-[11px] border px-2.5 py-1.5 text-[12px] font-bold transition-colors hover:bg-[var(--hover)]" style={{ borderColor: "var(--border)", color: "var(--danger-ink)" }}><Trash2 size={13} strokeWidth={2.2} /> Chiqit</button>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-2.5 flex items-center gap-1.5 text-[11.5px]" style={{ color: "var(--muted)" }}>
                      <Info size={12} strokeWidth={2.2} /> Chiqim yopish va to&apos;g&apos;rilash <Link href="/floristlarga-chiqarilgan" className="font-bold" style={{ color: "var(--primary)" }}>Floristlarga chiqarilgan</Link> sahifasida.
                    </p>
                  </>
                )}
            </Section>
          </>
        );
      })()}

      {florist && issueOpen && (
        <FloristStockIssueModal initialFlorist={id} batches={batches} florists={[florist]} onClose={() => setIssueOpen(false)} onDone={() => { loadBalances(); loadStats(); }} />
      )}
      {returnTarget && (
        <FloristStockReturnDrawer balance={returnTarget.balance} initialKind={returnTarget.kind} onClose={() => setReturnTarget(null)} onDone={() => { loadBalances(); loadStats(); }} />
      )}
    </div>
  );
}

function MiniRow({ k, v, tip }: { k: string; v: string; tip?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-2 text-[13px] last:border-b-0 last:pb-0" style={{ borderColor: "var(--line2)" }}>
      <span style={{ color: "var(--text-2)" }}>{k}{tip && <Tip text={tip} />}</span>
      <span className="font-bold tabular-nums">{v}</span>
    </div>
  );
}

function MixTable({ rows }: { rows: { label: string; sub: string; count: number; sold: number; amount: string }[] }) {
  if (rows.length === 0) return <p className="text-[12.5px]" style={{ color: "var(--muted)" }}>Ma&apos;lumot yo&apos;q.</p>;
  return (
    <div className="overflow-x-auto thin-scroll">
      <table className="w-full min-w-[300px] border-collapse text-[12.5px]">
        <thead><tr className="text-left" style={{ color: "var(--muted)" }}><th className="px-1 py-1 font-semibold">Turi</th>{rows.some((r) => r.sub) && <th className="px-1 py-1 font-semibold">Hajm</th>}<th className="px-1 py-1 text-right font-semibold">Soni</th><th className="px-1 py-1 text-right font-semibold">Sotildi</th><th className="px-1 py-1 text-right font-semibold">Haq</th></tr></thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t" style={{ borderColor: "var(--line2)" }}>
              <td className="px-1 py-1.5 font-semibold">{r.label}</td>
              {rows.some((x) => x.sub) && <td className="px-1 py-1.5" style={{ color: "var(--text-2)" }}>{r.sub || "—"}</td>}
              <td className="px-1 py-1.5 text-right tabular-nums">{r.count}</td>
              <td className="px-1 py-1.5 text-right tabular-nums">{r.sold}</td>
              <td className="px-1 py-1.5 text-right tabular-nums">{fmt(r.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
