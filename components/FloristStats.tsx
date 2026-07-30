"use client";
import { fmt, fmtDate, fmtTime } from "@/lib/format";
import DailyChart from "./DailyChart";
import EmptyState from "./EmptyState";
import type { FloristStats } from "@/lib/types";

/**
 * FLORIST STATISTIKASI — /florists/{id}/stats/ va /florists/me/dashboard/ bir xil
 * strukturani qaytaradi, shu bitta komponent ikkalasida ishlatiladi (admin detali
 * va floristning o'z dashboardi). Barcha raqamlar SERVER'dan (avtoritativ).
 */

const fmtMoney = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, " ");
const Tip = ({ text }: { text: string }) => <span title={text} className="ml-1 cursor-help align-middle text-[10px] font-bold" style={{ color: "var(--muted)" }}>ⓘ</span>;

function Card({ label, value, sub, hero, tip }: { label: string; value: string; sub?: string; hero?: boolean; tip?: string }) {
  return (
    <div className="glass-lite p-3.5" style={hero ? { background: "var(--primary)" } : undefined}>
      <div className="text-[10.5px] font-semibold uppercase tracking-wider" style={{ color: hero ? "rgba(255,255,255,0.7)" : "var(--muted)" }}>{label}{tip && !hero && <Tip text={tip} />}</div>
      <div className={`mt-1 whitespace-nowrap ${hero ? "text-[22px]" : "text-[18px]"} font-extrabold tracking-tight`} style={{ color: hero ? "#fff" : "var(--text)" }}>{value}</div>
      {sub && <div className="mt-0.5 text-[12px] font-medium" style={{ color: hero ? "rgba(255,255,255,0.8)" : "var(--text-2)" }}>{sub}</div>}
    </div>
  );
}

export default function FloristStats({ stats }: { stats: FloristStats }) {
  const s = stats.summary;
  // by_day yangi kun BIRINCHI keladi — grafik uchun teskari (eski → yangi)
  const daily = [...stats.by_day].reverse().map((d) => ({ date: d.work_date, oylik: Math.round(+d.amount), sotildi: d.sold_quantity }));
  const srcMax = Math.max(...stats.by_source.map((x) => +x.amount), 1);

  return (
    <div className="flex flex-col gap-4">
      {/* summary kartalar */}
      <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))" }}>
        <Card label="Jami oylik" value={`${fmtMoney(+s.salary_total)} so'm`} sub={`${s.salary_entries_count} yozuv`} hero />
        <Card label="Mahsulot" value={String(s.catalog_count)} sub={`${s.bouquet_count} buket · ${s.basket_count} savat`} />
        <Card label="Standart / Maxsus" value={`${s.standard_count} / ${s.custom_count}`} />
        <Card label="Sotilgan / Qolgan" value={`${s.sold_quantity} / ${s.unsold_quantity}`} />
        <Card label="Sotuv daromadi" value={`${fmtMoney(+s.sale_revenue)} so'm`} tip="Haqiqiy sotilgan narx (chegirmadan keyin) — ko'rsatilgan narx emas." />
        <Card label="O'rtacha haq" value={`${fmtMoney(+s.avg_fee_per_item)} so'm`} sub="1 mahsulotga" />
        <Card label="Ishlagan kunlar" value={String(s.attendance_days)} />
      </div>

      {/* by_day chart */}
      <section className="glass-lite p-4">
        <h4 className="mb-1 text-[14px] font-bold">Kunlik oylik</h4>
        <DailyChart data={daily} series={[
          { key: "oylik", label: "Oylik (so'm)", varName: "var(--chart-1)" },
          { key: "sotildi", label: "Sotilgan (dona)", varName: "var(--chart-2)" },
        ]} />
      </section>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        {/* by_source */}
        <section className="glass-lite p-4">
          <h4 className="mb-3 text-[14px] font-bold">Manba bo&apos;yicha</h4>
          <div className="flex flex-col gap-2.5">
            {stats.by_source.filter((x) => x.count > 0 || +x.amount > 0).length === 0 && <p className="text-[13px]" style={{ color: "var(--muted)" }}>Ma&apos;lumot yo&apos;q.</p>}
            {stats.by_source.filter((x) => x.count > 0 || +x.amount > 0).map((x) => (
              <div key={x.source} className="flex items-center gap-3">
                <span className="w-[92px] shrink-0 text-[13px] font-semibold">{x.source_label}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full" style={{ background: "var(--surface-2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${(+x.amount / srcMax) * 100}%`, background: "linear-gradient(90deg, var(--acc), var(--accL))" }} />
                </div>
                <span className="shrink-0 text-right text-[12.5px] font-bold tabular-nums">{fmt(x.amount)} <span className="font-medium" style={{ color: "var(--muted)" }}>· {x.count}</span></span>
              </div>
            ))}
          </div>
        </section>

        {/* by_volume + by_arrangement */}
        <section className="glass-lite p-4">
          <h4 className="mb-3 text-[14px] font-bold">Buket / Savat · Hajm bo&apos;yicha</h4>
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[380px] border-collapse text-[12.5px]">
              <thead><tr className="text-left" style={{ color: "var(--muted)" }}><th className="px-1 py-1 font-semibold">Turi</th><th className="px-1 py-1 font-semibold">Hajm</th><th className="px-1 py-1 text-right font-semibold">Soni</th><th className="px-1 py-1 text-right font-semibold">Sotildi</th><th className="px-1 py-1 text-right font-semibold">Haq</th></tr></thead>
              <tbody>
                {stats.by_volume.length === 0 && <tr><td colSpan={5} className="px-1 py-2" style={{ color: "var(--muted)" }}>Ma&apos;lumot yo&apos;q.</td></tr>}
                {stats.by_volume.map((v, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--line2)" }}>
                    <td className="px-1 py-1.5 font-semibold">{v.arrangement_label}</td>
                    <td className="px-1 py-1.5" style={{ color: "var(--text-2)" }}>{v.volume}</td>
                    <td className="px-1 py-1.5 text-right tabular-nums">{v.count}</td>
                    <td className="px-1 py-1.5 text-right tabular-nums">{v.sold_quantity}</td>
                    <td className="px-1 py-1.5 text-right tabular-nums">{fmt(v.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {/* salary_entries */}
      <section className="glass-lite p-4">
        <h4 className="mb-3 text-[14px] font-bold">Ish haqi yozuvlari</h4>
        {stats.salary_entries.length === 0 ? <EmptyState title="Yozuv yo'q" /> : (
          <div className="overflow-x-auto thin-scroll">
            <table className="w-full min-w-[720px] border-collapse text-[12.5px]">
              <thead><tr className="text-left" style={{ color: "var(--muted)" }}>
                <th className="px-1.5 py-1.5 font-semibold">Sana</th>
                <th className="px-1.5 py-1.5 font-semibold">Manba</th>
                <th className="px-1.5 py-1.5 font-semibold">Mahsulot</th>
                <th className="px-1.5 py-1.5 text-right font-semibold">Narxi</th>
                <th className="px-1.5 py-1.5 text-right font-semibold">Sotildi</th>
                <th className="px-1.5 py-1.5 text-right font-semibold">Sotuvdan</th>
                <th className="px-1.5 py-1.5 text-right font-semibold">Haq</th>
              </tr></thead>
              <tbody>
                {stats.salary_entries.map((e) => (
                  <tr key={e.id} className="border-t" style={{ borderColor: "var(--line2)" }}>
                    <td className="px-1.5 py-1.5 tabular-nums">{fmtDate(e.work_date)}</td>
                    <td className="px-1.5 py-1.5">{e.source_label}</td>
                    <td className="px-1.5 py-1.5">
                      {e.catalog_item_id ? (
                        <span>{e.catalog_name}<span className="block text-[11px]" style={{ color: "var(--muted)" }}>{[e.arrangement_label, e.volume].filter(Boolean).join(" · ")}</span></span>
                      ) : <span style={{ color: "var(--muted)" }}>{e.note || "—"}</span>}
                    </td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums" style={{ color: "var(--muted)" }}>{e.listed_price ? fmt(e.listed_price) : "—"}</td>
                    <td className="px-1.5 py-1.5 text-right">
                      {e.catalog_item_id
                        ? (e.is_sold ? <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: "color-mix(in srgb, var(--success-ink) 14%, transparent)", color: "var(--success-ink)" }}>{e.sold_quantity} ta</span> : <span style={{ color: "var(--muted)" }}>—</span>)
                        : <span style={{ color: "var(--muted)" }}>—</span>}
                    </td>
                    <td className="px-1.5 py-1.5 text-right tabular-nums">{+e.sale_revenue > 0 ? fmt(e.sale_revenue) : "—"}</td>
                    <td className="px-1.5 py-1.5 text-right font-bold tabular-nums">{fmt(e.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* attendance */}
      <section className="glass-lite p-4">
        <h4 className="mb-3 text-[14px] font-bold">Keldi-ketdi</h4>
        {stats.attendance.length === 0 ? <p className="text-[13px]" style={{ color: "var(--muted)" }}>Davomat yozuvi yo&apos;q.</p> : (
          <div className="flex flex-col gap-1.5">
            {stats.attendance.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-2 rounded-[10px] px-3 py-1.5 text-[12.5px]" style={{ background: "var(--surface-2)" }}>
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
      </section>
    </div>
  );
}
